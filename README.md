# Nuremberg

To be run as an AWS lambda. Nuremberg is part of the suite of services we run for our Slack workspace. 

## WTF is this?
Our slack workspace has another lambda that is invoked on Slack message events. That lambda, which unfortunately is not public, is responsible for saving our messages into a mongo DB. It also updates and deletes existing messages and records when we make edits to existing messages. Every 7 days, on Friday, we have judgement day. This lambda is invoked, which combs through the last 7 days worth of messages in the DB and:

1. Performs sentiment-analysis on everyone's messages, then assigns a score to each user. The sentiment analysis bit uses the Google NLP API.
2. Calculates arbitrary awards for users, similar to trophies you might see in a video game like Halo. Stuff like: person who was mentioned the most, person with the best score, person with the worst score, etc.
3. Saves the meta data for that week into the DB.
4. Gathers up the 5 worst messages for the week.
5. Sends a message to slack containing the scores, message counts, awards, guac bets.
5. Updates our guac* totals according to our sentiment scores. e.g. If someone's score is 5000, they gain 5000 guac.
7. Settles guac bets. We have a slash command that lets us bet on who will have the worst sentiment score that week. Nuremberg is responsible for paying out the winners.

* guac:
Guac is a made up currency we use in the slack channel, similar to gold in WoW or whatever. It means nothing and it doesn't matter. We have slash commands that let us bet, gift, and steal guac. You can see more about all that in https://github.com/vandelayindustries/operator.
