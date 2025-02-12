const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const cors = require('cors');
const app = express();
const port = 3000;
const tough = require('tough-cookie');
const axiosCookieJarSupport = require('axios-cookiejar-support').default;

const WHATSAPP_API_URL = 'https://graph.facebook.com/v21.0/475808092293189/messages';
const ACCESS_TOKEN = 'EAAIazcNERPEBO5kmUZBr9N5h56g42TjwFkV0pfVb4taplNIlPu6uA06GGZCL8aTcLhLa8snXDcDWSGh35wUmCSjP8QRE94ZBhZC4eJZCLxEFS79YWn2evvGZBRQfGXsRAGgu6VHlQFrgwZA7BV7stZC4cv1VFWFAi9rnaOXR8ov8JYNxoRldWPy09HuD0IJ9ynQ3DAZDZD'; // Replace with your actual access token
const VERIFY_TOKEN = 'EAAIazcNERPEBO5kmUZBr9N5h56g42TjwFkV0pfVb4taplNIlPu6uA06GGZCL8aTcLhLa8snXDcDWSGh35wUmCSjP8QRE94ZBhZC4eJZCLxEFS79YWn2evvGZBRQfGXsRAGgu6VHlQFrgwZA7BV7stZC4cv1VFWFAi9rnaOXR8ov8JYNxoRldWPy09HuD0IJ9ynQ3DAZDZD';
const FRAPPE_URL = "https://ups.sowaanerp.com";
const API_KEY = "6deab0c07f750cc";
const API_SECRET = "588f60f1a3a5255";



// Email validation function
function isValidEmail(email) {
    return email.includes("@") && email.includes(".");
}

// Phone number validation function
function isValidPhoneNumber(phone) {
    return /^(0\d{3}-?\d{6,10}|3\d{9,10}|92\d{10,12})$/.test(phone);
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
5️⃣ Arrange Call Back for Your Shipment
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
                        sendWhatsAppMessage(senderId, "⚠️ Invalid email. Please enter a valid email:");
                        ticketCreationState[senderId].pop(); // Remove invalid email
                    } else {
                        sendWhatsAppMessage(senderId, "📱 Please enter your mobile number:");
                    }
                    break;
        
                case 3:
                    if (!isValidPhoneNumber(ticketCreationState[senderId][2])) {
                        sendWhatsAppMessage(senderId, "⚠️ Invalid phone number. Please enter a valid phone number (9 to 13 digits):");
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
                    if (!["1", "2", "3"].includes(userMessage)) {
                        sendWhatsAppMessage(senderId, "⚠️ Invalid selection. Please choose a valid shipment type:\n1️⃣ Letter (0.5kg only)\n2️⃣ Document (0.5kg to 5kg only)\n3️⃣ Parcel (0.5kg to 70kg)");
                        ticketCreationState[senderId].pop(); // Remove invalid selection
                    } else {
                        sendWhatsAppMessage(senderId, "⚖️ Please enter shipment weight in kg:");
                    }
                    break;
        
                case 7:
                    if (isNaN(userMessage) || parseFloat(userMessage) <= 0) {
                        sendWhatsAppMessage(senderId, "⚠️ Invalid weight. Please enter a valid shipment weight in kg:");
                        ticketCreationState[senderId].pop(); // Remove invalid weight
                    } else {
                        // Extract all collected data
                        const [customerName, email, mobile, shipmentFrom, shipmentTo, shipmentType, weight] = ticketCreationState[senderId];
        
                        // Map shipment type to human-readable format
                        const shipmentTypeMap = {
                            "1": "Letter (0.5kg only)",
                            "2": "Document (0.5kg to 5kg only)",
                            "3": "Parcel (0.5kg to 70kg)"
                        };
        
                        const formattedShipmentType = shipmentTypeMap[shipmentType] || shipmentType;
        
                        // If user is selecting location, handle it separately
                        if (locationSelectionState[senderId]) {
                            const selectedLocation = officeLocations[userMessage];
                            if (selectedLocation) {
                                sendWhatsAppMessage(senderId, `📍 *${selectedLocation.name} Office Location:*\n${selectedLocation.address}\n${selectedLocation.link}\n0️⃣ Main Menu`);
                            } else {
                                sendWhatsAppMessage(senderId, "⚠️ Invalid selection. Please choose a valid option. \n0️⃣ Main Menu");
                            }
                            delete locationSelectionState[senderId]; // Clear state
                            return res.sendStatus(200);
                        }
        
                        // Prepare the ticket data for the API
                        const ticketData = {
                            custom_customer_name: customerName,
                            custom_customer_email_address: email,
                            custom_customer_contact_number: mobile,
                            subject: "Rate Inquiry Whatsapp",
                            raised_by: email,
                            agent_group: "TeleSales",
                            custom_employee: "WebAPI",
                            ticket_type: "Rate Inquiry",
                            description: `Shipment From: ${shipmentFrom}, Shipment To: ${shipmentTo}, Shipment Type: ${formattedShipmentType}, Weight: ${weight}kg`
                        };
        
                        // Clear the state after ticket creation
                        delete ticketCreationState[senderId];
        
                        // Create the ticket in the system
                        createTicketWithPuppeteer(senderId, ticketData);
                    }
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
                        sendWhatsAppMessage(senderId, "⚠️ Invalid email. Please enter a valid email.");
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
                        sendWhatsAppMessage(senderId, "❓ Please select your Request type:\n1️⃣ Commodity Information\n2️⃣ Customs Requirements / Paper Work\n3️⃣ Product Inquiry\n4️⃣ Transit Time\n5️⃣ Corporate or Business Account");
                    }
                    break;
                case 4:
                    if (!["1", "2", "3", "4", "5"].includes(ticketCreationStates[senderId][3])) {
                        sendWhatsAppMessage(senderId, "⚠️ Invalid option. Please select a valid Request type:\n1️⃣ Commodity Information\n2️⃣ Customs Requirements / Paper Work\n3️⃣ Product Inquiry\n4️⃣ Transit Time\n5️⃣ Corporate or Business Account");
                        ticketCreationStates[senderId].pop(); // Remove invalid option
                    } else {
                        sendWhatsAppMessage(senderId, "📦 (Optional) Enter tracking number if any:\n0️⃣ to skip");
                    }
                    break;
                case 5:
                    sendWhatsAppMessage(senderId, "🏦 (Optional) Enter your customer account number if any:\n0️⃣ to skip");
                    break;
                case 6:
                    sendWhatsAppMessage(senderId, "✍️ Please describe your issue or query:");
                    break;
                case 7:
                    const [customerName, email, mobile, ticketType, trackingNumber, accountNumber, description] = ticketCreationStates[senderId];
        
                    const ticketTypeMap = {
                        "1": "Commodity Information",
                        "2": "Customs Requirements / Paper Work",
                        "3": "Product Inquiry",
                        "4": "Transit Time",
                        "5": "Corporate or Business Account"
                    };
        
                    const formattedTicketType = ticketTypeMap[ticketType] || ticketType;
        
                    const ticketData = {
                        custom_customer_name: customerName,
                        subject: "Whatsapp General Query",
                        raised_by: email,
                        agent_group: "Customer Support",
                        custom_employee: "WebAPI",
                        ticket_type: formattedTicketType,
                        description: description,
                        custom_customer_email_address: email,
                        custom_customer_contact_number: mobile
                    };
        
                    if (trackingNumber.toLowerCase() !== '0') {
                        ticketData.custom_tracking_number_if_any = trackingNumber;
                    }
                    if (accountNumber.toLowerCase() !== '0') {
                        ticketData.custom_customer_account_number = accountNumber;
                    }
        
                    delete ticketCreationStates[senderId];
        
                    createTicketWithPuppeteer(senderId, ticketData);
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
                        sendWhatsAppMessage(senderId, "⚠️ Invalid email. Please enter a valid email.");
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
                    sendWhatsAppMessage(senderId, "📦 Please provide your tracking number.");
                    break;
                case 5:
                        sendWhatsAppMessage(senderId, "✍️ Please describe your issue or query:");
                        break;    
                case 6:
                    // Extract all collected data
                    const [customerName, email, mobile, callback, trackingNumber, query] = ticketCreationStatess[senderId];
        
                    // Prepare the ticket data for the API
                    const ticketData = {
                        custom_customer_name: customerName,
                        subject: "Whatsapp Call Back",
                        raised_by: email,
                        agent_group: "Customer Support",
                        custom_employee: "WebAPI",
                        ticket_type: "Call Back",
                        description: `Details: ${query}, CallBack Number: ${callback} `,
                        custom_customer_email_address: email,
                        custom_customer_contact_number: mobile,
                        custom_tracking_number_if_any: trackingNumber
                    };
        
                    // Include tracking number only if it starts with "1Z"
                    if (trackingNumber && trackingNumber.toUpperCase().startsWith("1Z")) {
                        ticketData.custom_tracking_number_if_any = trackingNumber;
                    }
        
                    // Clear the state after ticket creation
                    delete ticketCreationStatess[senderId];
        
                    // Create the ticket in the system
                    createTicketWithPuppeteer(senderId, ticketData);
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
const puppeteer = require('puppeteer');

async function createTicketWithPuppeteer(senderId, ticketData) {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    try {
        // Navigate to the ticket creation page
        await page.goto(`https://ups.sowaanerp.com/api/resource/HD%20Ticket`, {
            waitUntil: 'networkidle2'
        });

        // Set headers and cookies if needed
        await page.setExtraHTTPHeaders({
            "Authorization": `token 6deab0c07f750cc:588f60f1a3a5255`,
            "Content-Type": "application/json",
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9',
            'Accept-Language': 'en-US,en;q=0.5',
            "Referer": `https://ups.sowaanerp.com/`,
            "Origin": `https://ups.sowaanerp.com`
        });

        // Submit the ticket data
        const response = await page.evaluate(async (ticketData) => {
            return await fetch(`https://ups.sowaanerp.com/api/resource/HD%20Ticket`, {
                method: 'POST',
                headers: {
                    "Authorization": `token 6deab0c07f750cc:588f60f1a3a5255`,
                    "Content-Type": "application/json",
                    'User-Agent': userAgent,
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9',
                    'Accept-Language': 'en-US,en;q=0.5',
                    "Referer": `https://ups.sowaanerp.com/`,
                    "Origin": `https://ups.sowaanerp.com`
                },
                body: JSON.stringify(ticketData)
            }).then(res => res.json());
        }, ticketData);

        sendWhatsAppMessage(senderId, "✅ Your query has been received. Our team will contact you very soon. \n0️⃣ Main Menu");
        console.log("📌 Ticket created successfully:", response);
    } catch (error) {
        console.error("🚨 Error creating ticket:", error);
        sendWhatsAppMessage(senderId, "⚠️ Failed to create request. Please try again later. \n0️⃣ Main Menu");
    } finally {
        await browser.close();
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
