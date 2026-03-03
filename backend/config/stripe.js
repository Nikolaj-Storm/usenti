const Stripe = require('stripe');

if (!process.env.STRIPE_SECRET_KEY) {
    console.warn('⚠️ STRIPE_SECRET_KEY is missing from environment variables. Stripe integration will not work.');
}

// Initialize Stripe with the secret key
const stripe = Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2023-10-16', // Use the latest API version or pin to a specific one
    appInfo: {
        name: 'Usenti',
        version: '1.0.0',
        url: 'https://usenti.com'
    }
});

module.exports = stripe;
