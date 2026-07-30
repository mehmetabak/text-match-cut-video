import { Webhooks } from '@polar-sh/sdk';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { buffer } from 'micro';

// Disable default body parser for this route so we can verify the raw signature perfectly
export const config = {
  api: {
    bodyParser: false,
  },
};

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

// Removed admin.firestore() to prevent ReferenceError

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const isSandbox = process.env.POLAR_ENV === 'sandbox';
    const webhookSecret = isSandbox ? process.env.POLAR_SANDBOX_WEBHOOK_SECRET : process.env.POLAR_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error('CRITICAL: POLAR_WEBHOOK_SECRET or Sandbox Secret is not configured');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    // Get the raw body string to verify the cryptographic signature perfectly
    const rawBodyBuffer = await buffer(req);
    const rawBody = rawBodyBuffer.toString('utf8');
    
    // Polar sends the signature in headers
    const signatureHeaders = {
      'webhook-id': req.headers['webhook-id'],
      'webhook-timestamp': req.headers['webhook-timestamp'],
      'webhook-signature': req.headers['webhook-signature'],
    };

    if (!signatureHeaders['webhook-signature']) {
      console.error('SECURITY ALERT: Missing webhook signature');
      return res.status(401).json({ message: 'Missing signature' });
    }

    let event;
    try {
      // 100% SECURE: Verify that the request actually came from Polar and wasn't tampered with
      event = Webhooks.verify(rawBody, signatureHeaders, webhookSecret);
    } catch (err) {
      console.error('SECURITY ALERT: Webhook signature verification failed!', err.message);
      return res.status(403).json({ message: 'Invalid signature. Unauthorized.' });
    }

    // Handle the verified event
    const subscriptionEvents = [
      'subscription.created',
      'subscription.updated',
      'subscription.active',
      'subscription.canceled',
      'subscription.revoked'
    ];

    if (subscriptionEvents.includes(event.type) || event.type === 'order.created') {
      const data = event.data;
      
      // Extract firebaseUid safely across different metadata fields in Polar
      let firebaseUid = data.metadata?.firebaseUid || data.customer_metadata?.firebaseUid || data.customer?.metadata?.firebaseUid;
      
      // FALLBACK: If we still don't have the UID (e.g. older checkout session without customer metadata), 
      // let's try to match the user by email using Firebase Auth.
      if (!firebaseUid) {
        const customerEmail = data.customer?.email || data.customer_email;
        if (customerEmail) {
          try {
            const userRecord = await getAuth().getUserByEmail(customerEmail);
            if (userRecord && userRecord.uid) {
              firebaseUid = userRecord.uid;
              console.log(`[Webhook] Recovered missing UID via email lookup: ${firebaseUid} for ${customerEmail}`);
            }
          } catch (e) {
            console.error(`[Webhook] Could not find Firebase user by email: ${customerEmail}`);
          }
        }
      }

      console.log(`[Webhook] Event Received: ${event.type} for UID: ${firebaseUid}`);

      if (firebaseUid) {
        // Evaluate if user is PRO based on the status of the subscription/order
        let isPro = false;
        
        // Single-time order logic
        if (event.type === 'order.created') {
          isPro = true;
        } else {
          // Subscription logic based on status
          const activeStatuses = ['active', 'trialing'];
          const isCanceled = data.status === 'canceled';
          const now = new Date();
          let periodEnd = null;
          
          if (data.current_period_end || data.currentPeriodEnd) {
             periodEnd = new Date(data.current_period_end || data.currentPeriodEnd);
          }

          if (activeStatuses.includes(data.status) && event.type !== 'subscription.revoked') {
            isPro = true;
          } else if (isCanceled && periodEnd && periodEnd > now && event.type !== 'subscription.revoked') {
            // User canceled but still has remaining paid time
            isPro = true;
          } else {
            // Status is past_due, unpaid, incomplete_expired, revoked, or canceled+expired
            isPro = false;
          }
        }

        // Update user in Firestore
        const db = getFirestore();
        const userRef = db.collection('users').doc(firebaseUid);
        
        await userRef.set({
          isPro: isPro,
          subscriptionPlan: isPro ? 'pro' : 'free',
          polarSubscriptionId: data.id,
          polarCustomerId: data.customer_id,
          polarStatus: data.status || 'unknown',
          updatedAt: FieldValue.serverTimestamp()
        }, { merge: true });
        
        console.log(`[Webhook] Successfully updated user ${firebaseUid} isPro: ${isPro}`);
      } else {
        console.error('[Webhook] No firebaseUid found in the webhook payload metadata:', JSON.stringify(data.metadata));
      }
    } else {
      console.log(`[Webhook] Ignoring event type: ${event.type}`);
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
