import { Polar } from '@polar-sh/sdk';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

// Initialize Firebase Admin if not already initialized
if (!getApps().length) {
  try {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
  } catch (error) {
    console.error('Firebase admin initialization error', error.stack);
  }
}

const db = getFirestore();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    // 1. Verify User Identity via Firebase Token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const idToken = authHeader.split('Bearer ')[1];
    let decodedToken;
    try {
      decodedToken = await getAuth().verifyIdToken(idToken);
    } catch (error) {
      console.error('Firebase token verification failed:', error);
      return res.status(401).json({ message: 'Invalid or expired token' });
    }

    const firebaseUid = decodedToken.uid;
    const userEmail = decodedToken.email;

    // 2. Fetch User from Firestore
    const userRef = db.collection('users').doc(firebaseUid);
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) {
      return res.status(404).json({ message: 'User not found in database' });
    }

    const userData = userDoc.data();
    let customerId = userData.polarCustomerId;

    // 3. Setup Polar SDK
    const isSandbox = process.env.POLAR_ENV === 'sandbox';
    const polarAccessToken = isSandbox ? process.env.POLAR_SANDBOX_ACCESS_TOKEN : process.env.POLAR_ACCESS_TOKEN;
    
    if (!polarAccessToken) {
      return res.status(500).json({ message: 'Server configuration error' });
    }

    const polar = new Polar({
      accessToken: polarAccessToken,
      server: isSandbox ? 'sandbox' : 'production',
    });

    // 4. Find Customer if not locally linked
    if (!customerId && userEmail) {
      try {
        // We can search customers by email or just rely on them not being pro
        // Actually Polar API doesn't allow easy email search directly in some SDK versions, 
        // so we'll gracefully handle it.
        // If they don't have polarCustomerId, we assume Free, unless verify-checkout sets it.
      } catch (e) {
        console.error("Polar customer lookup failed", e);
      }
    }

    if (!customerId) {
      // If still no customer ID, they definitely don't have a subscription
      if (userData.isPro) {
        // Fix inconsistency
        await userRef.update({ isPro: false, updatedAt: FieldValue.serverTimestamp() });
      }
      return res.status(200).json({ isPro: false });
    }

    // 5. Fetch Active Subscriptions
    let subscriptionsResponse;
    try {
      // Using list endpoint. The SDK uses camelCase generally. 
      // If it fails we'll return the current db status.
      subscriptionsResponse = await polar.subscriptions.list({
        customerId: customerId,
        active: true, // Only fetch active or trialing
        limit: 10
      });
    } catch (error) {
      // Fallback if parameter names are slightly different in this SDK version
      try {
        subscriptionsResponse = await polar.subscriptions.list({
          customer_id: customerId,
          active: true,
          limit: 10
        });
      } catch (innerError) {
        console.error("Failed to fetch subscriptions:", innerError);
        return res.status(200).json({ isPro: userData.isPro, note: "Fallback to local db" });
      }
    }

    const subscriptions = subscriptionsResponse?.items || subscriptionsResponse?.data || [];
    let isPro = false;
    const now = new Date();

    // 6. Check Validity (Status & Dates)
    for (const sub of subscriptions) {
      const status = sub.status; // 'active', 'trialing', 'canceled', etc.
      let periodEnd = null;
      if (sub.currentPeriodEnd || sub.current_period_end) {
        periodEnd = new Date(sub.currentPeriodEnd || sub.current_period_end);
      }

      const isActiveStatus = ['active', 'trialing'].includes(status);
      const isCanceled = status === 'canceled';

      if (isActiveStatus) {
        isPro = true;
        break;
      } else if (isCanceled && periodEnd && periodEnd > now) {
        // User canceled, but their paid period hasn't ended yet!
        isPro = true;
        break;
      }
    }

    // 7. Sync to Firestore if changed
    if (userData.isPro !== isPro) {
      await userRef.update({ 
        isPro: isPro, 
        updatedAt: FieldValue.serverTimestamp() 
      });
    }

    return res.status(200).json({ success: true, isPro: isPro });

  } catch (error) {
    console.error('Error in JIT sync-subscription:', error);
    return res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
}
