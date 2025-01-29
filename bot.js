const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const cors = require('cors');
const app = express();
const port = 3000;

const WHATSAPP_API_URL = 'https://graph.facebook.com/v21.0/475808092293189/messages';
const ACCESS_TOKEN = 'EAAIazcNERPEBO5kmUZBr9N5h56g42TjwFkV0pfVb4taplNIlPu6uA06GGZCL8aTcLhLa8snXDcDWSGh35wUmCSjP8QRE94ZBhZC4eJZCLxEFS79YWn2evvGZBRQfGXsRAGgu6VHlQFrgwZA7BV7stZC4cv1VFWFAi9rnaOXR8ov8JYNxoRldWPy09HuD0IJ9ynQ3DAZDZD'; // Replace with your actual access token
const VERIFY_TOKEN = 'EAAIazcNERPEBO5kmUZBr9N5h56g42TjwFkV0pfVb4taplNIlPu6uA06GGZCL8aTcLhLa8snXDcDWSGh35wUmCSjP8QRE94ZBhZC4eJZCLxEFS79YWn2evvGZBRQfGXsRAGgu6VHlQFrgwZA7BV7stZC4cv1VFWFAi9rnaOXR8ov8JYNxoRldWPy09HuD0IJ9ynQ3DAZDZD';
const FRAPPE_URL = "https://ups-uat.sowaanerp.com";
const API_KEY = "a660048fb475f8f";  
const API_SECRET = "15044e3bdf6d010";  

app.use(cors({
    origin: '*',  // Allow all domains, you can replace '*' with specific domains like ['http://example.com'] to allow only specific origins
    methods: ['GET', 'POST'],  // Allow GET and POST methods
    allowedHeaders: ['Content-Type', 'Authorization'],  // Allow these headers
    credentials: true,  // Allow credentials if needed
}));

app.use(bodyParser.json());

// Store user states for tracking requests
let userTrackingState = {};
let leadCreationState = {};

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
    console.log("\ud83d\udce5 Received webhook data:", JSON.stringify(data, null, 2));

    const message = data?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    const contact = data?.entry?.[0]?.changes?.[0]?.value?.contacts?.[0];

    if (message && contact) {
        const senderId = message.from;
        const userMessage = message.text?.body.trim();

        // TRACKING FLOW (Option 1)
        if (userTrackingState[senderId]) {
            const trackingNumber = userMessage;
            delete userTrackingState[senderId]; // Clear state

            sendWhatsAppMessage(senderId, `\ud83d\udd0d Fetching details for tracking number: *${trackingNumber}*...`);
            try {
                const trackingResponse = await axios.get(`https://excel-api-0x2r.onrender.com/track/${trackingNumber}`);
                const packageData = trackingResponse.data.trackResponse?.shipment[0]?.package[0];

                if (packageData) {
                    const formattedActivities = packageData.activity?.map(activity => 
                        `\ud83d\udfe1 ${activity.status.description} - ${activity.location.address.city}, ${activity.location.address.country} on ${activity.date.slice(0, 4)}-${activity.date.slice(4, 6)}-${activity.date.slice(6, 8)}`
                    ).join("\n") || "No activity available.";

                    const trackingDetails = `\ud83d\udce6 *Tracking Number:* ${trackingNumber}
\ud83d\ude9a *Status:* ${packageData.currentStatus?.description || "N/A"}
\ud83d\udcc5 *Delivery Date:* ${packageData.deliveryDate ? packageData.deliveryDate[0]?.date : "N/A"}
\ud83d\udce6 *Weight:* ${packageData.weight?.weight || "N/A"} kg

✈️ *Shipment Journey:*
${formattedActivities}`;

                    sendWhatsAppMessage(senderId, trackingDetails);
                } else {
                    sendWhatsAppMessage(senderId, "⚠️ No shipment details found for this tracking number.");
                }
            } catch (error) {
                sendWhatsAppMessage(senderId, "⚠️ Error fetching shipment details.");
            }
            return res.sendStatus(200);
        }

        // LEAD CREATION FLOW (Option 2)
        if (leadCreationState[senderId]) {
            leadCreationState[senderId].push(userMessage);

            switch (leadCreationState[senderId].length) {
                case 1:
                    sendWhatsAppMessage(senderId, "📧 Please enter your email:");
                    break;
                case 2:
                    sendWhatsAppMessage(senderId, "📱 Please enter your mobile number:");
                    break;
                case 3:
                    sendWhatsAppMessage(senderId, "📦 Are you interested in *Export* or *Import*? (Reply with 'Export' or 'Import')");
                    break;
                case 4:
                    sendWhatsAppMessage(senderId, `❓ Please select your request type:\n1️⃣ Rate Inquiry\n2️⃣ Transit Time\n3️⃣ Customs Requirements / Paper Work\n4️⃣ Destination\n5️⃣ Commodity Information\n6️⃣ Product Inquiry`);
                    break;
                case 5:
                    sendWhatsAppMessage(senderId, "✍️ Please enter more details about your request:");
                    break;
                case 6:
                    const [leadName, email, mobile, leadType, requestType, requestDetails] = leadCreationState[senderId];
                    
                    const requestTypeMap = {
                        "1": "Rate Inquiry",
                        "2": "Transit Time",
                        "3": "Customs Requirements / Paper Work",
                        "4": "Destination",
                        "5": "Commodity Information",
                        "6": "Product Inquiry"
                    };

                    const formattedRequestType = requestTypeMap[requestType] || requestType;

                    const leadData = {
                        lead_name: leadName,
                        email_id: email,
                        mobile_no: mobile,
                        status: "Open",
                        custom_lead_type: leadType,
                        custom_request_type2: formattedRequestType,
                        custom_request_details: requestDetails
                    };

                    delete leadCreationState[senderId]; // Clear state after lead creation
                    createLead(senderId, leadData);
                    break;
            }
            return res.sendStatus(200);
        }

        // OPTION SELECTION HANDLING
        switch (userMessage) {
            case "1":
                userTrackingState[senderId] = true;
                sendWhatsAppMessage(senderId, "📦 Please enter your tracking number:");
                break;
            case "2":
                leadCreationState[senderId] = [];
                sendWhatsAppMessage(senderId, "📝 Please enter your full name:");
                break;
            default:
                sendWhatsAppMessage(senderId, welcomeMessage);
        }
    }
    res.sendStatus(200);
});
async function createLead(senderId, leadData) {
    try {
        const response = await axios.post(`${FRAPPE_URL}/api/resource/Lead`, leadData, {
            headers: {
                "Authorization": `token ${API_KEY}:${API_SECRET}`,
                "Content-Type": "application/json"
            }
        });
        sendWhatsAppMessage(senderId, "✅ Your business inquiry has been recorded. Our team will contact you shortly.");
        console.log("📌 Lead created successfully:", response.data);
    } catch (error) {
        console.error("🚨 Error creating lead:", error.response?.data || error.message);
        sendWhatsAppMessage(senderId, "⚠️ Failed to create business inquiry. Please try again later.");
    }
}
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
