const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const cors = require('cors');
const app = express();
const port = 3000;

const WHATSAPP_API_URL = 'https://graph.facebook.com/v21.0/475808092293189/messages';
const ACCESS_TOKEN = 'EAAIazcNERPEBO5kmUZBr9N5h56g42TjwFkV0pfVb4taplNIlPu6uA06GGZCL8aTcLhLa8snXDcDWSGh35wUmCSjP8QRE94ZBhZC4eJZCLxEFS79YWn2evvGZBRQfGXsRAGgu6VHlQFrgwZA7BV7stZC4cv1VFWFAi9rnaOXR8ov8JYNxoRldWPy09HuD0IJ9ynQ3DAZDZD'; // Replace with your actual access token
const VERIFY_TOKEN = 'EAAIazcNERPEBO5kmUZBr9N5h56g42TjwFkV0pfVb4taplNIlPu6uA06GGZCL8aTcLhLa8snXDcDWSGh35wUmCSjP8QRE94ZBhZC4eJZCLxEFS79YWn2evvGZBRQfGXsRAGgu6VHlQFrgwZA7BV7stZC4cv1VFWFAi9rnaOXR8ov8JYNxoRldWPy09HuD0IJ9ynQ3DAZDZD';
const FRAPPE_URL = "https://ups.sowaanerp.com";
const API_KEY = "7f9ceafe1f9cb28";
const API_SECRET = "3a6c7afa65a4bee";

app.use(cors({
    origin: '*',  // Allow all domains, you can replace '*' with specific domains like ['http://example.com'] to allow only specific origins
    methods: ['GET', 'POST'],  // Allow GET and POST methods
    allowedHeaders: ['Content-Type', 'Authorization'],  // Allow these headers
    credentials: true,  // Allow credentials if needed
}));

app.use(bodyParser.json());

// Store user states for tracking requests
let userTrackingState = {};
let ticketCreationState = {}; // New state for ticket creation
let locationSelectionState = {};

// Define office locations
const officeLocations = {
    "1": { name: "Sialkot", address: "CHOWK ANWAR, KHAWAJA MONUMENT, HAJI PURA ROAD, NEAR FAYSAL BANK, SIALKOT - PAKISTAN. (0092) 52-3556344,3556347" },
    "2": { name: "Karachi", address: "E-15/ PECHS, BLOCK 6, SHAHRA-E-FAISAL, NURSERY, KARACHI-PAKISTAN. (0092) 21-34521387-88" },
    "3": { name: "Lahore", address: "204 - SCOTCH CORNER, UPPER MALL, SCHEME LAHORE - PAKISTAN.0092) 42-35753888,35754666" },
    "4": { name: "Faisalabad", address: "OFFICE NO. 13, REGENCY INTERNATIONAL 949, THE MALL, NEAR BEST WESTERN HOTEL, OPP PIA OFFICE, FAISALABAD - PAKISTAN. PH: (0092) 41-2600236" },
    "5": { name: "Peshawar", address: "MDF 23, GROUND FLOOR NAMAL PLAZA, KHYBER SUPER MARKET, BARA ROAD, NEAR QAYYUM STADIUM PESHAWAR - PAKISTAN (0092) 91-5252046-47" },
    "6": { name: "Islamabad", address: "BUILDING NO. 19 FAQIR APPI ROAD, NEAR METRO CASH & CARRY SECTOR I - 11/3, ISLAMABAD - PAKISTAN. (0092) 51-8733361-62, 51-4863971-72" },
};

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

        // LOCATION SELECTION FLOW (Option 3)
        if (locationSelectionState[senderId]) {
            const selectedLocation = officeLocations[userMessage];
            if (selectedLocation) {
                sendWhatsAppMessage(senderId, `📍 *${selectedLocation.name} Office Location:*\n${selectedLocation.address}`);
            } else {
                sendWhatsAppMessage(senderId, "⚠️ Invalid selection. Please choose a valid option.");
            }
            delete locationSelectionState[senderId]; // Clear state
            return res.sendStatus(200);
        }

        // TICKET CREATION FLOW (Option 2)
        if (ticketCreationState[senderId]) {
            ticketCreationState[senderId].push(userMessage);

            switch (ticketCreationState[senderId].length) {
                case 1:
                    sendWhatsAppMessage(senderId, "📧 Please enter your email:");
                    break;
                case 2:
                    sendWhatsAppMessage(senderId, "📱 Please enter your mobile number:");
                    break;
                case 3:
                    sendWhatsAppMessage(senderId, "❓ Please select your ticket type:\n1️⃣ Commodity Information Whatsapp\n2️⃣ Corporate / Business Account Whatsapp");
                    break;
                case 4:
                    sendWhatsAppMessage(senderId, "✍️ Please describe your issue or query:");
                    break;
                case 5:
                    // Extract all collected data
                    const [customerName, email, mobile, ticketType, description] = ticketCreationState[senderId];

                    // Map ticket type to a human-readable format
                    const ticketTypeMap = {
                        "1": "Commodity Information Whatsapp",
                        "2": "Corporate / Business Account Whatsapp"
                    };

                    const formattedTicketType = ticketTypeMap[ticketType] || ticketType;

                    // Prepare the ticket data for the API
                    const ticketData = {
                        custom_customer_name: customerName,
                        subject: "Whatsapp Query",
                        raised_by: "mraza@ups.com",
                        agent_group: "TeleSales",
                        custom_employee: "EMP603",
                        ticket_type: formattedTicketType,
                        description: description,
                        email: email,
                        mobile_no: mobile
                    };

                    // Clear the state after ticket creation
                    delete ticketCreationState[senderId];

                    // Create the ticket in the system
                    createTicket(senderId, ticketData);
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
                ticketCreationState[senderId] = [];
                sendWhatsAppMessage(senderId, "📝 Please enter your full name:");
                break;
            case "3":
                locationSelectionState[senderId] = true;
                const locationList = Object.entries(officeLocations)
                    .map(([key, location]) => `${key}️⃣ ${location.name}`)
                    .join("\n");
                sendWhatsAppMessage(senderId, `🏢 Please select a location:\n${locationList}`);
                break;
            default:
                sendWhatsAppMessage(senderId, welcomeMessage);
        }
    }
    res.sendStatus(200);
});

// Function to create a ticket
async function createTicket(senderId, ticketData) {
    try {
        const response = await axios.post(`${FRAPPE_URL}/api/resource/HD%20Ticket`, ticketData, {
            headers: {
                "Authorization": `token ${API_KEY}:${API_SECRET}`,
                "Content-Type": "application/json"
            }
        });
        sendWhatsAppMessage(senderId, "✅ Your ticket has been created successfully. Our team will contact you shortly.");
        console.log("📌 Ticket created successfully:", response.data);
    } catch (error) {
        console.error("🚨 Error creating ticket:", error.response?.data || error.message);
        sendWhatsAppMessage(senderId, "⚠️ Failed to create ticket. Please try again later.");
    }
}

// Function to send a WhatsApp message
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
