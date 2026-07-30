import { Polar } from '@polar-sh/sdk';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
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
    const customerEmail = decodedToken.email;

    // 2. Setup Polar SDK
    const isSandbox = process.env.POLAR_ENV === 'sandbox';
    const polarAccessToken = isSandbox ? process.env.POLAR_SANDBOX_ACCESS_TOKEN : process.env.POLAR_ACCESS_TOKEN;
    const polarProductId = isSandbox ? process.env.POLAR_SANDBOX_PRODUCT_ID : process.env.POLAR_PRODUCT_ID;

    if (!polarAccessToken || !polarProductId) {
      console.error('Missing Polar credentials (POLAR_ACCESS_TOKEN or POLAR_PRODUCT_ID)');
      return res.status(500).json({ message: 'Server configuration error' });
    }

    const polar = new Polar({
      accessToken: polarAccessToken,
      server: isSandbox ? 'sandbox' : 'production',
    });

    // 3. Fetch User from Firestore to get polarCustomerId
    const { getFirestore, FieldValue } = await import('firebase-admin/firestore');
    const db = getFirestore();
    const userDoc = await db.collection('users').doc(firebaseUid).get();
    let existingCustomerId = null;
    
    if (userDoc.exists) {
      existingCustomerId = userDoc.data().polarCustomerId;
    }

    // 4. Create Checkout Session
    // Using absolute URL for success page based on request headers
    const protocol = req.headers['x-forwarded-proto'] || 'http';
    const host = req.headers.host;
    const successUrl = `${protocol}://${host}/account?payment=success&checkout_id={CHECKOUT_ID}`;

    const checkoutConfig = {
      products: [polarProductId],
      successUrl: successUrl,
      // CRITICAL: Bind the user's UID securely in the session metadata
      // Pass it to both checkout metadata AND customer metadata so it propagates to subscriptions
      metadata: {
        firebaseUid: firebaseUid,
      },
      customerMetadata: {
        firebaseUid: firebaseUid,
      }
    };

    // If user already has a Polar customer ID, use it so Polar links them perfectly.
    // Otherwise, pass their email so Polar can create a new customer or match by email.
    if (existingCustomerId) {
      checkoutConfig.customerId = existingCustomerId;
    } else {
      checkoutConfig.customerEmail = customerEmail;
    }

    let checkout;
    try {
      checkout = await polar.checkouts.create(checkoutConfig);
    } catch (error) {
      const errorStr = JSON.stringify(error, Object.getOwnPropertyNames(error));
      if (errorStr.includes("Customer does not exist")) {
        console.warn("Polar customer was deleted in dashboard. Clearing from Firebase and retrying...");
        await db.collection('users').doc(firebaseUid).update({
          polarCustomerId: FieldValue.delete()
        });
        delete checkoutConfig.customerId;
        checkoutConfig.customerEmail = customerEmail;
        checkout = await polar.checkouts.create(checkoutConfig);
      } else {
        throw error;
      }
    }

    // 5. Return Checkout URL to Frontend
    return res.status(200).json({ url: checkout.url });

  } catch (error) {
    let errorStr = 'Unknown error';
    try {
      errorStr = JSON.stringify(error, Object.getOwnPropertyNames(error));
    } catch(e) {
      errorStr = String(error);
    }
    console.error('Error creating Polar checkout session:', errorStr);
    return res.status(500).json({ message: 'Internal Server Error', error: errorStr });
  }
}
