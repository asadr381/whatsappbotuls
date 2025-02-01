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
const API_SECRET = "107d1e30c242a6f";

// Email validation function
function isValidEmail(email) {
    const allowedDomains = ["@ups.com", "@gmail.com", "@yahoo.com"];
    return allowedDomains.some(domain => email.endsWith(domain));
}

// Phone number validation function
function isValidPhoneNumber(phone) {
    return /^\d{9,13}$/.test(phone);
}

app.use(cors({
    origin: '*',  // Allow all domains
    methods: ['GET', 'POST'],  // Allow GET and POST methods
    allowedHeaders: ['Content-Type', 'Authorization'],  // Allow these headers
    credentials: true,  // Allow credentials if needed
}));

app.use(bodyParser.json());

// Store user states for tracking requests
let userTrackingState = {};
let ticketCreationState = {}; // State for ticket creation
let locationSelectionState = {};
let ticketCreationStates = {}; // State for general query
let ticketCreationStatess = {}; // State for customer service

// Define office locations
const officeLocations = {
    "1": { name: "Sialkot", address: "CHOWK ANWAR, KHAWAJA MONUMENT, HAJI PURA ROAD, NEAR FAYSAL BANK, SIALKOT - PAKISTAN. (0092) 52-3556344,3556347", link: "https://www.google.com/maps?q=32.473460674551234,74.51881949317858" },
    "2": { name: "Karachi", address: "E-15/ PECHS, BLOCK 6, SHAHRA-E-FAISAL, NURSERY, KARACHI-PAKISTAN. (0092) 21-34521387-88", link: "https://www.google.com/maps?q=24.8596337,67.0657547" },
    "3": { name: "Lahore", address: "204 - SCOTCH CORNER, UPPER MALL, SCHEME LAHORE - PAKISTAN.0092) 42-35753888,35754666", link: "https://www.google.com/maps?q=31.543372414055295,74.35411971970743" },
    "4": { name: "Faisalabad", address: "OFFICE NO. 13, REGENCY INTERNATIONAL 949, THE MALL, NEAR BEST WESTERN HOTEL, OPP PIA OFFICE, FAISALABAD - PAKISTAN. PH: (0092) 41-2600236", link: "https://www.google.com/maps?q=31.42243233736654,73.08960740199518"  },
    "5": { name: "Peshawar", address: "MDF 23, GROUND FLOOR NAMAL PLAZA, KHYBER SUPER MARKET, BARA ROAD, NEAR QAYYUM STADIUM PESHAWAR - PAKISTAN (0092) 91-5252046-47", link: "https://www.google.com/maps?q=33.98999008689488,71.53431641136997" },
    "6": { name: "Islamabad", address: "BUILDING NO. 19 FAQIR APPI ROAD, NEAR METRO CASH & CARRY SECTOR I - 11/3, ISLAMABAD - PAKISTAN. (0092) 51-8733361-62, 51-4863971-72", link: "https://www.google.com/maps?q=33.643544744771546,73.02197573414695" },
};

const welcomeMessage = `🌟 *Welcome to UNIVERSAL LOGISTICS SERVICES, AUTHORIZED SERVICE CONTRACTOR FOR UPS* 🌟

Dense fog has enveloped many areas, creating visibility challenges.  
This fog may slow us down, but it will not stop us. Our commitment to serving you remains unwavering.  

📦 *Thank you for choosing ULS!*  

Please reply with an option number:  
1️⃣ Track your Shipment  
2️⃣ Get Shipment Rates  
3️⃣ Locate Nearest Express Centre  
4️⃣ General Query  
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
                        `\ud83d\udfe1 ${activity.status.description || " "}  - ${activity.location.address.city || " "}, ${activity.location.address.country || " "} on ${activity.date.slice(0, 4) || " "}-${activity.date.slice(4, 6) || " "}-${activity.date.slice(6, 8) || " "}`
                    ).join("\n") || "No activity available.";

                    const trackingDetails = `\ud83d\udce6 *Tracking Number:* ${trackingNumber}
\ud83d\ude9a *Status:* ${packageData.currentStatus?.description || "N/A"}
\ud83d\udcc5 *Delivery Date:* ${packageData.deliveryDate ? packageData.deliveryDate[0]?.date : "N/A"}
\ud83d\udce6 *Weight:* ${packageData.weight?.weight || "N/A"} kg

✈️ *Shipment Journey:*
${formattedActivities}`;

                    sendWhatsAppMessage(senderId, trackingDetails);
                    sendWhatsAppMessage(senderId, "0️⃣ Main Menu");
                } else {
                    sendWhatsAppMessage(senderId, "⚠️ No shipment details found for this tracking number.");
                }
            } catch (error) {
                sendWhatsAppMessage(senderId, "⚠️ Error fetching shipment details. \n0️⃣ Main Menu");
      
            }
            return res.sendStatus(200);
        }

        // LOCATION SELECTION FLOW (Option 3)
        if (locationSelectionState[senderId]) {
            const selectedLocation = officeLocations[userMessage];
            if (selectedLocation) {
                sendWhatsAppMessage(senderId, `📍 *${selectedLocation.name} Office Location:*\n${selectedLocation.address} \n${selectedLocation.link} \n0️⃣ Main Menu` );
     
            } else {
                sendWhatsAppMessage(senderId, "⚠️ Invalid selection. Please choose a valid option. \n0️⃣ Main Menu");
    
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
                    if (!isValidEmail(ticketCreationState[senderId][1])) {
                        sendWhatsAppMessage(senderId, "⚠️ Invalid email. Please enter a valid email ending with @ups.com, @gmail.com, or @yahoo.com.");
                        ticketCreationState[senderId].pop(); // Remove invalid email
                    } else {
                        sendWhatsAppMessage(senderId, "📱 Please enter your mobile number:");
                    }
                    break;
                case 3:
                    if (!isValidPhoneNumber(ticketCreationState[senderId][2])) {
                        sendWhatsAppMessage(senderId, "⚠️ Invalid phone number. Please enter a valid phone number (9 to 13 digits).");
                        ticketCreationState[senderId].pop(); // Remove invalid phone number
                    } else {
                        sendWhatsAppMessage(senderId, "🌍 Please enter shipment country from:");
                    }
                    break;
                case 4:
                    sendWhatsAppMessage(senderId, "🌍 Please enter shipment country to:");
                    break;
                case 5:
                    sendWhatsAppMessage(senderId, "📦 Please select shipment type:\n1️⃣ Letter (0.5kg only)\n2️⃣ Document (0.5kg to 5kg only)\n3️⃣ Parcel (0.5kg to 70kg)");
                    break;
                case 6:
                    sendWhatsAppMessage(senderId, "⚖️ Please enter shipment weight in kg:");
                    break;
                case 7:
                    // Extract all collected data
                    const [customerName, email, mobile, shipmentFrom, shipmentTo, shipmentType, weight] = ticketCreationState[senderId];

                    // Map shipment type to a human-readable format
                    const shipmentTypeMap = {
                        "1": "Letter (0.5kg only)",
                        "2": "Document (0.5kg to 5kg only)",
                        "3": "Parcel (0.5kg to 70kg)"
                    };

                    const formattedShipmentType = shipmentTypeMap[shipmentType] || shipmentType;

                    // Prepare the ticket data for the API
                    const ticketData = {
                        custom_customer_name: customerName,
                        custom_customer_email_address: email,
                        custom_customer_contact_number: mobile,
                        subject: "Whatsapp Shipment Query",
                        raised_by: "mraza@ups.com",
                        agent_group: "TeleSales",
                        custom_employee: "EMP603",
                        ticket_type: "Rate Inquiry Whatsapp",
                        description: `Shipment From: ${shipmentFrom}, Shipment To: ${shipmentTo}, Weight: ${weight}kg, Shipment Type: ${formattedShipmentType}`
                    };

                    // Clear the state after ticket creation
                    delete ticketCreationState[senderId];

                    // Create the ticket in the system
                    createTicket(senderId, ticketData);
                    break;
            }
            return res.sendStatus(200);
        }

        // GENERAL QUERY FLOW (Option 4)
        if (ticketCreationStates[senderId]) {
            ticketCreationStates[senderId].push(userMessage);

            switch (ticketCreationStates[senderId].length) {
                case 1:
                    sendWhatsAppMessage(senderId, "📧 Please enter your email:");
                    break;
                case 2:
                    if (!isValidEmail(ticketCreationStates[senderId][1])) {
                        sendWhatsAppMessage(senderId, "⚠️ Invalid email. Please enter a valid email ending with @ups.com, @gmail.com, or @yahoo.com.");
                        ticketCreationStates[senderId].pop(); // Remove invalid email
                    } else {
                        sendWhatsAppMessage(senderId, "📱 Please enter your mobile number:");
                    }
                    break;
                case 3:
                    if (!isValidPhoneNumber(ticketCreationStates[senderId][2])) {
                        sendWhatsAppMessage(senderId, "⚠️ Invalid phone number. Please enter a valid phone number (9 to 13 digits).");
                        ticketCreationStates[senderId].pop(); // Remove invalid phone number
                    } else {
                        sendWhatsAppMessage(senderId, "❓ Please select your ticket type:\n1️⃣ Commodity Information\n2️⃣Customs Requirements / Paper Work  \n3️⃣ Product Inquiry  \n4️⃣ Rate Inquiry  \n5️⃣ Transit Time");
                    }
                    break;
                case 4:
                    sendWhatsAppMessage(senderId, "📦 (Optional) Enter tracking number if any:\n 0️⃣ to skip");
                    break;
                case 5:
                    sendWhatsAppMessage(senderId, "🏦 (Optional) Enter your customer account number if any:\n 0️⃣ to skip");
                    break;
                case 6:
                    sendWhatsAppMessage(senderId, "✍️ Please describe your issue or query:");
                    break;
                case 7:
                    // Extract all collected data
                    const [customerName, email, mobile, ticketType, description, trackingNumber, accountNumber] = ticketCreationStates[senderId];

                    // Map ticket type to a human-readable format
                    const ticketTypeMap = {
                        "1": "Commodity Information Whatsapp",
                        "2": "Customs Requirements / Paper Work Whatsapp",
                        "3": "Product Inquiry Whatsapp",
                        "4": "Rate Inquiry Whatsapp",
                        "5": "Transit Time Whatsapp"
                    };

                    const formattedTicketType = ticketTypeMap[ticketType] || ticketType;

                    // Prepare the ticket data for the API
                    const ticketData = {
                        custom_customer_name: customerName,
                        subject: "General Query",
                        raised_by: "mraza@ups.com",
                        agent_group: "TeleSales",
                        custom_employee: "EMP603",
                        ticket_type: formattedTicketType,
                        description: description,
                        custom_customer_email_address: email,
                        custom_customer_contact_number: mobile
                    };

                    // Include optional fields if they are provided
                    if (trackingNumber.toLowerCase() !== '0') {
                        ticketData.custom_tracking_number_if_any = trackingNumber;
                    }
                    if (accountNumber.toLowerCase() !== '0') {
                        ticketData.custom_customer_account_number = accountNumber;
                    }

                    // Clear the state after ticket creation
                    delete ticketCreationStates[senderId];

                    // Create the ticket in the system
                    createTicket(senderId, ticketData);
                    break;
            }
            return res.sendStatus(200);
        }

        // CUSTOMER SERVICE FLOW (Option 5)
        if (ticketCreationStatess[senderId]) {
            ticketCreationStatess[senderId].push(userMessage);

            switch (ticketCreationStatess[senderId].length) {
                case 1:
                    sendWhatsAppMessage(senderId, "📧 Please enter your email:");
                    break;
                case 2:
                    if (!isValidEmail(ticketCreationStatess[senderId][1])) {
                        sendWhatsAppMessage(senderId, "⚠️ Invalid email. Please enter a valid email ending with @ups.com, @gmail.com, or @yahoo.com.");
                        ticketCreationStatess[senderId].pop(); // Remove invalid email
                    } else {
                        sendWhatsAppMessage(senderId, "📱 Please enter your mobile number:");
                    }
                    break;
                case 3:
                    if (!isValidPhoneNumber(ticketCreationStatess[senderId][2])) {
                        sendWhatsAppMessage(senderId, "⚠️ Invalid phone number. Please enter a valid phone number (9 to 13 digits).");
                        ticketCreationStatess[senderId].pop(); // Remove invalid phone number
                    } else {
                        sendWhatsAppMessage(senderId, "📱 Please Enter Your CallBack Number");
                    }
                    break;
                case 4:
                    sendWhatsAppMessage(senderId, "✍️ Please describe your issue or query:");
                    break;
                case 5:
                    // Extract all collected data
                    const [customerName, email, mobile, callback, query] = ticketCreationStatess[senderId];

                    // Prepare the ticket data for the API
                    const ticketData = {
                    custom_customer_name: customerName,
                    subject: "Call Back",
                    raised_by: "mraza@ups.com",
                    agent_group: "Customer Support",
                    custom_employee: "EMP603",
     
                    description: `Details: ${query}, CallBack Number: ${callback} `,
                    custom_customer_email_address: email,
                    custom_customer_contact_number: mobile
                };
    
                // Include optional fields if they are provided
         
                // Clear the state after ticket creation
                delete ticketCreationStates[senderId];
    
                // Create the ticket in the system
                createTicket(senderId, ticketData);
                break;
        }
        return res.sendStatus(200);
    }
    

        // OPTION SELECTION HANDLING
        switch (userMessage) {
            case "0":
                sendWhatsAppMessage(senderId, welcomeMessage);
                break;
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
            case "4":
                    ticketCreationStates[senderId] = [];
                    sendWhatsAppMessage(senderId, "📝 Please enter your full name:");
                    break;
            case "5":
                    ticketCreationStatess[senderId] = [];
                    sendWhatsAppMessage(senderId, "📝 Please enter your full name:");
                    
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
        sendWhatsAppMessage(senderId, "✅ Your query has been received. Our team will contact you very soon. \n0️⃣ Main Menu");

        console.log("📌 Ticket created successfully:", response.data);
    } catch (error) {
        console.error("🚨 Error creating ticket:", error.response?.data || error.message);
        sendWhatsAppMessage(senderId, "⚠️ Failed to create request. Please try again later. \n0️⃣ Main Menu");

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
