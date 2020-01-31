const db        = require('./db');
const conf      = require('../config');
const slack     = require('./slack');
const User      = require('./classes/user');
const Meta      = require('./classes/meta');
const createMsg = require('./create-slack-msg');

const getOneWeek = () => new Date( Date.now() - 6.048e8 );

/**
 * Fetches messages from the database for the last seven days.
 * @returns {Promise} - array of messages
 * @throws
 */
function fetchMessages() {
  return db.db.collection('messages')
    .find({ updated: { $gt: getOneWeek() } })
    .sort({ updated: -1 })
    .toArray();
}

/**
 * Fetches users using the messages provided.
 * @param {Object} messages
 * @returns {Object} - a map of users by id
 * @throws
 */
async function fetchUsersFromMessages( messages ) {
  const users = {};

  for ( const { user: id } of messages ) {
    if ( !users[ id ] ) {
      const details = await slack.users.info({
        user: id,
        include_locale: false
      });

      users[ id ] = details.user;
    }
  }

  return users;
}

/**
 * Upserts the users into the database into the 'users' collection.
 * @param {Object} users
 * @throws
 */
async function saveUsers( users ) {
  const col = db.db.collection('users');

  // upsert users
  for ( const user of Object.values( users ) ) {
    const userModel = new User( user );
    const filter = { id: userModel.data.id };
    await col.findOneAndReplace( filter, userModel.data, { upsert: true } );
  }
}

/**
 * Calculates the sentiment scores and message count for each user
 * @param {Object} messages
 * @param {Object} users
 * @returns {Object} the message counts and sentiment score for each user
 */
function calculateSentimentAndMsgCount( messages, users ) {
  const userIds = Object.keys( users );

  const metaDataByUser = Object.fromEntries( userIds.map( user => {
    const metaObj = new Meta({
      user,
      sentiment: 0,
      msgCount:  0,
      start:     getOneWeek(),
      end:       new Date()
    });

    return [ user, metaObj ];
  }));

  for ( const { user, sentiment } of messages ) {
    metaDataByUser[ user ].data.sentiment += sentiment;
    metaDataByUser[ user ].data.msgCount += 1;
  }

  for ( const metaObj of Object.values( metaDataByUser ) ) {
    metaObj.data.sentiment = metaObj.data.sentiment / metaObj.data.msgCount;
  }

  return metaDataByUser;
}

/**
 * Saves metadata into the db.
 * @param {Array} - Meta instances
 * @returns {Promise}
 * @throws
 */
async function saveMeta( meta ) {
  return db.db.collection('meta').insertMany( meta.map( m => m.data ) );
}

/**
 * Sends message to slack channel
 * @param {String} - message
 * @returns {Promise}
 * @throws
 */
function sendSlackMsg( message ) {
  return slack.chat.postMessage({
    channel: conf.slackResultsChannel,
    blocks:  JSON.stringify( message ),
    text:    ''
  });
}

async function handler( event, context ) {
  try {
    await db.connect();

    // messages from the  last 7 days
    const messages = await fetchMessages();

    // users in the channel over the last 7 days
    const users = await fetchUsersFromMessages( messages );

    // upsert the users into the database
    await saveUsers( users );

    // calculate average sentiment and total msg count for each user
    const metaData = calculateSentimentAndMsgCount( messages, users );

    // save the metadata into the db
    await saveMeta( Object.values( metaData ) );

    // create slack message
    const msg = createMsg( users, messages, metaData );

    // send message to slack
    await sendSlackMsg( msg );

  } catch ( err ) {
    console.error( 'Failed with error: ', err );
  } finally {
    db.close();
  }
}

module.exports = { handler };
