/**
 * TO RUN SEEDER:
 * 1. Download service-account.json from Firebase Console (Project Settings -> Service Accounts -> Generate New Private Key).
 * 2. Save it to this folder as `service-account.json`.
 * 3. Run: npm install firebase-admin
 * 4. Run: node seed.js
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Verify service credentials exist
const serviceAccountPath = path.join(__dirname, 'service-account.json');
if (!fs.existsSync(serviceAccountPath)) {
  console.error("❌ ERROR: service-account.json is missing in this folder!");
  console.log("Please retrieve it from your Firebase console before running the seeder.");
  process.exit(1);
}

const serviceAccount = require(serviceAccountPath);

// Retrieve local database config json
const dataPath = path.join(__dirname, 'seed-data.json');
const rawData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

// Initialize administration connection
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: `https://${serviceAccount.project_id}-default-rtdb.firebaseio.com` // Adjust if database URL is custom
});

const db = admin.firestore();
const rtdb = admin.database();

async function seedData() {
  try {
    console.log("🏀 STARTING NBA FINALS CLOUD SEEDING...");

    // 1. SEED FIRESTORE (Series structures, Player profiles and Bios)
    for (const [eraKey, eraData] of Object.entries(rawData.eras)) {
      console.log(`\n📂 Seeding Era: ${eraKey}`);

      // Seed core era details
      await db.collection('series').doc(eraKey).set({
        seriesScore: eraData.seriesScore,
        seriesStatus: eraData.seriesStatus,
        venue: eraData.venue,
        knicksSubtitle: eraData.knicks.subtitle,
        spursSubtitle: eraData.spurs.subtitle
      });

      // Seed Knicks players
      for (const player of eraData.knicks.roster) {
        await db.collection('players').doc(`${eraKey}_knicks_${player.name.replace(/\s+/g, '_').toLowerCase()}`).set({
          ...player,
          team: 'knicks',
          era: eraKey
        });
      }

      // Seed Spurs players
      for (const player of eraData.spurs.roster) {
        await db.collection('players').doc(`${eraKey}_spurs_${player.name.replace(/\s+/g, '_').toLowerCase()}`).set({
          ...player,
          team: 'spurs',
          era: eraKey
        });
      }

      // Seed game metrics
      for (const game of eraData.games) {
        await db.collection('matches').doc(game.id).set({
          ...game,
          era: eraKey
        });
      }
    }
    console.log("✅ Firestore documents successfully written!");

    // 2. SEED REALTIME DATABASE (Fan chats & ticker commentary stream)
    console.log("\n⚡ Seeding Realtime Database elements...");
    
    const initialChats = {
      classic_1999: [
        { user: "SpreeFan8", text: "Sprewell is on fire! MSG is absolutely rockin' tonight!", timestamp: Date.now() - 3600000 },
        { user: "SpursGal99", text: "Robinson and Duncan Twin Towers are unguardable in the post.", timestamp: Date.now() - 1800000 }
      ],
      dream_2026: [
        { user: "BrunsonBurner", text: "Jalen is gonna bring a banner home to 33rd Street!", timestamp: Date.now() - 3600000 },
        { user: "WembyAlien", text: "You can't shoot over 7 foot 4 wingspan. Spurs dynasty returns!", timestamp: Date.now() - 1800000 }
      ]
    };

    const initialTicker = {
      classic_1999: [
        { text: "Arena lights dim down. Welcome to the historic Game 5 of the 1999 NBA Finals!" },
        { text: "Avery Johnson brings the ball up-court under physical pressure from Charlie Ward." }
      ],
      dream_2026: [
        { text: "Welcome to Madison Square Garden! Decibels hitting record limits in Manhattan." },
        { text: "Victor Wembanyama blocks Julius Randle down low out of bounds!" }
      ]
    };

    await rtdb.ref('chats').set(initialChats);
    await rtdb.ref('ticker').set(initialTicker);

    console.log("✅ Realtime Database seed items complete!");
    console.log("\n🎉 ALL SEEDING SUCCESSFUL! Your Cloud Firebase Suite is ready to rock! 🏀");
    process.exit(0);

  } catch (error) {
    console.error("❌ Seeding encountered failure: ", error);
    process.exit(1);
  }
}

seedData();