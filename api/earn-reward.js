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
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  try {
    // 1. Verify User Identity via Firebase Token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const idToken = authHeader.split('Bearer ')[1];
    let decodedToken;
    try {
      decodedToken = await getAuth().verifyIdToken(idToken);
    } catch (error) {
      console.error('Firebase token verification failed:', error);
      return res.status(401).json({ success: false, message: 'Invalid or expired token' });
    }

    const uid = decodedToken.uid;
    
    // Validate requested points
    let pointsToAdd = parseInt(req.body?.points, 10);
    if (isNaN(pointsToAdd) || pointsToAdd <= 0) {
      pointsToAdd = 10; // Default to 10 points
    }
    
    // SECURITY: Cap the maximum points a user can request per ad to prevent abuse
    if (pointsToAdd > 50) {
      pointsToAdd = 50;
    }

    // 2. Fetch user data directly from Firestore securely
    const userRef = db.collection('users').doc(uid);
    
    // We use a Firestore transaction to ensure atomic updates and prevent race conditions
    // where a user might send 10 requests at the exact same millisecond to bypass the limit.
    const result = await db.runTransaction(async (transaction) => {
      const userDoc = await transaction.get(userRef);
      
      if (!userDoc.exists) {
        throw new Error('Kullanıcı bulunamadı');
      }

      const userData = userDoc.data();
      const today = new Date().toISOString().split('T')[0];
      
      let adsToday = userData.adRewardsToday || 0;
      let lastDate = userData.lastAdRewardDate || '';
      let currentPoints = userData.adRewardPoints || 0;
      
      // Reset limit if it's a new day
      if (lastDate !== today) {
        adsToday = 0;
        lastDate = today;
      }
      
      // Check limit securely on backend
      if (adsToday >= 5) {
        return { success: false, message: "Günlük reklam izleme limitine (5) ulaştınız. Yarın tekrar deneyin!", error: true };
      }
      
      const newPoints = currentPoints + pointsToAdd;
      adsToday += 1;
      
      transaction.set(userRef, {
        adRewardPoints: newPoints,
        adRewardsToday: adsToday,
        lastAdRewardDate: lastDate,
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
      
      return {
        success: true,
        data: {
          adRewardPoints: newPoints,
          adRewardsToday: adsToday,
          lastAdRewardDate: lastDate
        }
      };
    });

    if (result.error) {
      return res.status(400).json(result);
    }

    return res.status(200).json(result);

  } catch (error) {
    console.error('Error in earn-reward API:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
}
