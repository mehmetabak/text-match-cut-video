import { Polar } from '@polar-sh/sdk';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
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

    // 2. Fetch User from Firestore to get polarCustomerId
    const userDoc = await db.collection('users').doc(firebaseUid).get();
    if (!userDoc.exists) {
      return res.status(404).json({ message: 'User not found in database' });
    }

    const userData = userDoc.data();
    const customerId = userData.polarCustomerId;

    if (!customerId) {
      return res.status(400).json({ 
        message: 'No Polar Customer ID found for this user. If you just upgraded, please check your email for the management link.' 
      });
    }

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

    // 4. Create Customer Session (Portal)
    const session = await polar.customerSessions.create({
      customerId: customerId,
    });

    // 5. Return Portal URL to Frontend
    return res.status(200).json({ url: session.customerPortalUrl });

  } catch (error) {
    console.error('Error creating Polar customer session:', error);
    return res.status(500).json({ message: 'Internal Server Error', error: error.message || error.toString() });
  }
}
