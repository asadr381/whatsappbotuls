const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const cors = require('cors');
const app = express();
const port = 3000;

const WHATSAPP_API_URL = 'https://graph.facebook.com/v21.0/475808092293189/messages';
const ACCESS_TOKEN = 'EAAIazcNERPEBO5kmUZBr9N5h56g42TjwFkV0pfVb4taplNIlPu6uA06GGZCL8aTcLhLa8snXDcDWSGh35wUmCSjP8QRE94ZBhZC4eJZCLxEFS79YWn2evvGZBRQfGXsRAGgu6VHlQFrgwZA7BV7stZC4cv1VFWFAi9rnaOXR8ov8JYNxoRldWPy09HuD0IJ9ynQ3DAZDZD'; // Replace with your actual access token
const VERIFY_TOKEN = 'EAAIazcNERPEBO5kmUZBr9N5h56g42TjwFkV0pfVb4taplNIlPu6uA06GGZCL8aTcLhLa8snXDcDWSGh35wUmCSjP8QRE94ZBhZC4eJZCLxEFS79YWn2evvGZBRQfGXsRAGgu6VHlQFrgwZA7BV7stZC4cv1VFWFAi9rnaOXR8ov8JYNxoRldWPy09HuD0IJ9ynQ3DAZDZD';

// Enable CORS for all requests
app.use(cors({
    origin: '*',  // Allow all domains, you can replace '*' with specific domains like ['http://example.com'] to allow only specific origins
    methods: ['GET', 'POST'],  // Allow GET and POST methods
    allowedHeaders: ['Content-Type', 'Authorization'],  // Allow these headers
    credentials: true,  // Allow credentials if needed
}));

app.use(bodyParser.json());

// Store user states for tracking requests
let userTrackingState = {};

const welcomeMessage = `🌟 *Welcome to UNIVERSAL LOGISTICS SERVICES, AUTHORIZED SERVICE CONTRACTOR FOR UPS* 🌟

Dense fog has enveloped many areas, creating visibility challenges.  
This fog may slow us down, but it will not stop us. Our commitment to serving you remains unwavering.  

📦 *Thank you for choosing ULS!*  

Please reply with an option number:  
1️⃣ Track your Shipment  
2️⃣ Get Shipment Rates  
3️⃣ Locate Nearest Express Centre  
4️⃣ Business Customers or Open an Account  
5️⃣ Arrange Call Back from Customer Services
6️⃣ Billing Query


`;

// Webhook verification route (GET request)
app.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token && mode === 'subscribe' && token === VERIFY_TOKEN) {
        res.status(200).send(challenge);
    } else {
        res.sendStatus(403);
    }
});

// Webhook for incoming messages
app.post('/webhook', async (req, res) => {
    let data = req.body;
    console.log("📥 Received webhook data:", JSON.stringify(data, null, 2));

    const message = data?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    const contact = data?.entry?.[0]?.changes?.[0]?.value?.contacts?.[0];

    if (message && contact) {
        const senderId = message.from;
        const senderName = contact.profile?.name || "User";
        const userMessage = message.text?.body.trim();

        console.log(`💬 Message received from ${senderName}:`, userMessage);

        if (userTrackingState[senderId]) {
            // User is expected to send a tracking number
            const trackingNumber = userMessage;
            delete userTrackingState[senderId]; // Clear tracking request state
            
            sendWhatsAppMessage(senderId, `🔍 Fetching details for tracking number: *${trackingNumber}*...`);
            
            // Fetch tracking data from API
            try {
                // Fetch tracking details
                const trackingResponse = await axios.get(`https://excel-api-0x2r.onrender.com/track/${trackingNumber}`);
                const packageData = trackingResponse.data.trackResponse?.shipment[0]?.package[0];

                if (packageData) {
                    const deliveryDate = packageData.deliveryDate?.[0]?.date || "N/A";
                    const formattedDeliveryDate = deliveryDate !== "N/A"
                        ? `${deliveryDate.slice(0, 4)}-${deliveryDate.slice(4, 6)}-${deliveryDate.slice(6, 8)}`
                        : "N/A";

                    const formattedActivities = packageData.activity?.map(activity => {
                        return `🟡 ${activity.status.description} - ${activity.location.address.city}, ${activity.location.address.country} on ${activity.date.slice(0, 4)}-${activity.date.slice(4, 6)}-${activity.date.slice(6, 8)} at ${activity.time.slice(0, 2)}:${activity.time.slice(2, 4)}:${activity.time.slice(4, 6)}`;
                    }).join("\n") || "No activity available.";

                    const trackingDetails = `📦 *Tracking Number:* ${trackingNumber}
🚚 *Status:* ${packageData.currentStatus?.description || "N/A"}
📅 *Delivery Date:* ${formattedDeliveryDate}
📍 *Last Location:* ${packageData.activity?.[0]?.location?.address?.city || "Unknown"}, ${packageData.activity?.[0]?.location?.address?.country || "Unknown"}
📦 *Weight:* ${packageData.weight?.weight || "N/A"} kg
📜 *Service:* ${packageData.service?.description || "N/A"}

✈️ *Shipment Journey:*
${formattedActivities}`;

                    sendWhatsAppMessage(senderId, trackingDetails);
                } else {
                    sendWhatsAppMessage(senderId, "⚠️ No shipment details found for this tracking number.");
                }
            } catch (error) {
                console.error("🚨 Error fetching shipment details:", error);
                sendWhatsAppMessage(senderId, "⚠️ An error occurred while fetching shipment details. Please try again.");
            }
        } else if (userMessage === "1") {
            userTrackingState[senderId] = true;
            sendWhatsAppMessage(senderId, "📦 Please enter your tracking number:");
        } else {
            sendWhatsAppMessage(senderId, welcomeMessage);
        }
    }
    res.sendStatus(200);
});

// Function to send a WhatsApp message
async function sendWhatsAppMessage(to, text) {
    try {
        await axios.post(WHATSAPP_API_URL, {
            messaging_product: "whatsapp",
            to,
            text: { body: text }
        }, {
            headers: {
                "Authorization": `Bearer ${ACCESS_TOKEN}`,
                "Content-Type": "application/json"
            }
        });
        console.log(`✅ Sent message to ${to}:`, text);
    } catch (error) {
        console.error("🚨 Error sending WhatsApp message:", error.response?.data || error.message);
    }
}


// Function to send a message via the WhatsApp API
async function sendWhatsAppMessage(to, message) {
    const payload = {
        messaging_product: 'whatsapp',
        to: to,
        type: 'text',
        text: { body: message }
    };

    try {
        const response = await axios.post(WHATSAPP_API_URL, payload, {
            headers: {
                Authorization: `Bearer ${ACCESS_TOKEN}`,
                'Content-Type': 'application/json',
            },
        });
        console.log('✅ Message sent successfully:', JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.error('❌ Error sending message:', error.response ? error.response.data : error.message);
    }
}

app.listen(port, () => {
    console.log(`🚀 Server is running on http://localhost:${port}`);
});
