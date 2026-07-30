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
    const { checkoutId } = req.body;
    if (!checkoutId) {
      return res.status(400).json({ message: 'Missing checkoutId' });
    }

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

    // 2. Setup Polar SDK
    const isSandbox = process.env.POLAR_ENV === 'sandbox';
    const polarAccessToken = isSandbox ? process.env.POLAR_SANDBOX_ACCESS_TOKEN : process.env.POLAR_ACCESS_TOKEN;
    
    if (!polarAccessToken) {
      return res.status(500).json({ message: 'Server configuration error' });
    }

    const polar = new Polar({
      accessToken: polarAccessToken,
      server: isSandbox ? 'sandbox' : 'production',
    });

    // 3. Verify Checkout with Polar
    let checkout;
    try {
      checkout = await polar.checkouts.get({ id: checkoutId });
    } catch (e) {
      console.error('Error fetching checkout from Polar:', e);
      return res.status(404).json({ message: 'Checkout not found in Polar' });
    }

    // Check if checkout is successful
    if (checkout.status === 'succeeded' || checkout.status === 'confirmed') {
      
      // SECURITY CHECK (Prevent IDOR): Ensure this checkout actually belongs to the requesting user!
      const checkoutFirebaseUid = checkout.metadata?.firebaseUid || checkout.customerMetadata?.firebaseUid || checkout.customer_metadata?.firebaseUid;
      const checkoutEmail = checkout.customerEmail || checkout.customer_email || checkout.customer?.email;
      const userEmail = decodedToken.email;

      let isOwner = false;
      if (checkoutFirebaseUid) {
        if (checkoutFirebaseUid === firebaseUid) isOwner = true;
      } else if (checkoutEmail && userEmail) {
        if (checkoutEmail.toLowerCase() === userEmail.toLowerCase()) isOwner = true;
      }

      if (!isOwner) {
        console.warn(`SECURITY ALERT: User ${firebaseUid} (${userEmail}) tried to claim checkout ${checkoutId} which does not belong to them.`);
        return res.status(403).json({ message: 'Unauthorized. This checkout does not belong to your account.' });
      }

      // 4. Update Firestore
      const userRef = db.collection('users').doc(firebaseUid);
      
      // Try to extract customer ID from checkout
      const customerId = checkout.customerId || checkout.customer_id;
      
      const updateData = {
        isPro: true,
        updatedAt: FieldValue.serverTimestamp()
      };
      
      if (customerId) {
        updateData.polarCustomerId = customerId;
      }
      
      await userRef.set(updateData, { merge: true });
      
      return res.status(200).json({ success: true, isPro: true });
    } else {
      return res.status(200).json({ success: false, status: checkout.status });
    }

  } catch (error) {
    console.error('Error verifying Polar checkout:', error);
    return res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
}
