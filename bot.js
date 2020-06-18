const fs = require('fs');
const ip = require('ip');
const Discord = require('discord.io');
const logger = require('winston');
const nodemailer = require("nodemailer");
const auth = require('./savedData/auth.json');

if (!fs.existsSync("./savedData/savedData.json")) {
    var json = {
        "notificaton_emails": [],
        "newsletter_emails": [],
        "channels": [],
        "oldMovies": [],
        "oldShows": [],
        "requestNum": 100,
        "requests": JSON.stringify([...(new Map())])
    };
    fs.mkdir('./savedData', { recursive: true }, (err) => {if (err) throw err;});
    fs.writeFileSync('./savedData/savedData.json', JSON.stringify(json, null, 2));
}

const savedData = require('./savedData/savedData.json');
const apiResource = require('./apiResource.js');
const htmlResource = require('./htmlResource.js');

class PlexRequest {
    constructor(channelID, messageID, request) {
        this.channelID = channelID;
        this.messageID = messageID;
        this.request = request;
    }
}

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: auth.email,
        pass: auth.emailpass
    }
});

var oldMovies = new Set(savedData.oldMovies);
var oldShows = new Set(savedData.oldShows);
var lastWeeksShows = new Set(savedData.lastWeeksShows);
var lastWeeksMovies = new Set(savedData.lastWeeksMovies);
var recommendedMovies = new Set(savedData.recommendedMovies);
var recommendedShows = new Set(savedData.recommendedMovies);

var monitoringChannels = savedData.channels;
var monitoringEmails = savedData.notificaton_emails;
var newsletterEmails = savedData.newsletter_emails;

var requestNum = savedData.requestNum;
var requests = new Map();

if (!requestNum) {
    updateSavedDataFile();
    requestNum = 100;
    requests = new Map();
} else {
    requests = new Map(savedData.requests)
}

// Configure logger settings
logger.remove(logger.transports.Console);
logger.add(new logger.transports.Console, {
    colorize: true
});
logger.level = 'debug';
// Initialize Discord Bot
var bot = new Discord.Client({
    token: auth.token,
    autorun: true
});

bot.on('ready', function (evt) {
    logger.info('Connected');
    logger.info('Logged in as: ');
    logger.info(bot.username + ' - (' + bot.id + ')');
    setInterval(function () {
        monitoringAction()
    }, 1000 * 60 * 60 * 3);
    // setInterval(function(){monitoringAction()}, 3000);
});

bot.on('disconnect', function(erMsg, code) {
    console.log('----- Bot disconnected from Discord with code', code, 'for reason:', erMsg, '-----');
    bot.connect();
});

bot.on('message', function (user, userID, channelID, message, evt) {
    // It will listen for messages that will start with `~`
    if (message.substring(0, 1) === '~') {
        var args = message.substring(1).split(' ');
        var cmd = args[0];

        args = args.splice(1);
        switch (cmd) {
            case 'request':
                sendRequest(channelID, user, args.join(' '), false);
                break;
            case 'request_test':
                sendRequest(channelID, user, args.join(' '), true);
                break;
            case 'status_update':
                if (userID == 116976756581203972) {
                    statusUpdate(channelID, parseInt(args[0]), args[1]);
                }
                break;
            case 'status_update_test':
                if (userID == 139462400658112513) {
                    statusUpdate(channelID, parseInt(args[0]), args[1]);
                }
                break;
            case 'latest_movies':
                showRecentlyAddedMovies(channelID);
                break;
            case 'latest_shows':
                showRecentlyAddedShows(channelID);
                break;
            case 'start_monitor':
                startMonitoring(channelID);
                break;
            case 'stop_monitor':
                stopMonitoring(channelID);
                break;
            case 'subscribe':
                subscribe(channelID, args.join(' '));
                break;
            case 'unsubscribe':
                unsubscribe(channelID, args.join(' '));
                break;
            case 'help':
                bot.sendMessage({
                    to: channelID,
                    message: '**Welcome!** I am the Deep Media Plex Bot! My current duties are to provide recently added shows and movies.\n**Commands** - Start with \'~\'\n\`request [text]: Slides a Plex request into the Will\'s DMs. Can add any text to describe a request\nlatest_movies : Get information on the last 5 added movies\nlatest_shows : Get information on the last 5 added episodes\nstart_monitor : Starts monitoring the server. I will send messages whenever a new movie or show is added\nstop_monitor : Stops monitoring the server\nsubscribe [email address]: Subscribes that email to a get notifications when new things are added\nunsubscribe [email address]: Unsubscribes email address from mailing list\nreport [alltime, day, week, month] : Gives a stat report within the given time frame\nuser_stats [username] : Gives stats on the given user\nusers : Gives list of all users and their ids\n (ADMIN ONLY) status_update [request id] [status]: Only available in DMs of Plex Admin. Plex admin can respond to a request with the request id and then followed with the following status options [\'s\' = searching, \'f\' = found, \'n\' = not found]. This will update the original request message with the new status.\`'
                });
                break;
            case 'report':
                if (args.length !== 0) {
                    showReport(channelID, args[0]);
                } else {
                    showReport(channelID, "alltime");
                }
                break;
            case 'user_stats':
                showUserStats(channelID, args.join(' '));
                break;
            case 'users':
                showUsers(channelID);
                break;
            case 'ip':
                bot.sendMessage({
                    to: channelID,
                    message: `IP Address where PlexBot is running is ${ip.address()}`
                });
                break;
            case 'crash_bot':
                bot.sendMessage({
                    to: channelID,
                    message: 'Crashing Bot ...'
                });
                crashingBotVariable.add(channelID);
                break;
            case 'bot_last_updated':
                bot.sendMessage({
                    to: channelID,
                    message: 'Bot was last updated on April 6th 2020 at 11:45 German Time :mag:'
                });
                break;
            case 'trigger_email':
                emailTest(args.join(' '));
                bot.sendMessage({
                    to: channelID,
                    message: 'Sent test email to Jonah'
                });
                break;
        }
    }
});

// Slides a plex request into Will's DMs
function sendRequest(channelID, user, request, test) {
    var admin = '116976756581203972';
    if (test)
        admin = '139462400658112513';
    bot.sendMessage({
        to: admin,
        message: `From: ${user}\nPlex Request: ${request}\nRequest ID: ${requestNum}`
    });
    bot.sendMessage({
        to: channelID,
        message: `Request "${request}" sent to Plex Admin.\nCheck back here for status updates on the request.`
    }, function (err, res) {
        requests.set(requestNum, new PlexRequest(channelID, res.id, request));
        if (requestNum === 999)
            requestNum = 100;
        else
            requestNum++;
        updateSavedDataFile();
    });
}

function statusUpdate(channelID, requestNumId, newStatus) {
    if (requests.has(requestNumId)) {
        var plexRequest = requests.get(requestNumId);
        var statusMessage = "";
        if (newStatus === "2" || newStatus === "found" || newStatus === "f") {
            statusMessage = "Status: :white_check_mark: Found"
        } else if (newStatus === "3"|| newStatus === "not_found" || newStatus === "n") {
            statusMessage = "Status: :x: Not Found"
        } else {
            statusMessage = "Status: :mag: Searching ..."
        }

        bot.editMessage({
            channelID: plexRequest.channelID,
            messageID: plexRequest.messageID,
            message: `Request "${plexRequest.request}" sent to Plex Admin.\n${statusMessage}`
        });
        bot.sendMessage({
            to: channelID,
            message: `Request Status Updated`
        });
    }
}

function startMonitoring(channelID) {
    if (!monitoringChannels.some(e => e === channelID)) {
        monitoringChannels.push(channelID);
        bot.sendMessage({
            to: channelID,
            message: 'Now monitoring Plex server for newly added movies and shows.'
        });
        updateSavedDataFile();
    } else {
        bot.sendMessage({
            to: channelID,
            message: 'Monitoring for Plex server has already been started.'
        });
    }
}

function stopMonitoring(channelID) {
    if (monitoringChannels.some(e => e === channelID)) {
        delete monitoringChannels[channelID];
        bot.sendMessage({
            to: channelID,
            message: 'Monitoring for Plex server has stopped.'
        });
        updateSavedDataFile();
    } else {
        bot.sendMessage({
            to: channelID,
            message: 'Monitoring for Plex server is already stopped.'
        });
    }
}

function subscribe(channelID, email) {
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        if (!monitoringEmails.some(e => e === email)) {
            monitoringEmails.push(email);
            bot.sendMessage({
                to: channelID,
                message: `${email} is now subscribed to Plex sever!`
            });
            updateSavedDataFile();
        } else {
            bot.sendMessage({
                to: channelID,
                message: 'Already subscribed to Plex server.'
            });
        }
    } else {
        bot.sendMessage({
            to: channelID,
            message: 'Invalid email address.'
        });
    }
}

function unsubscribe(channelID, email) {
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        if (monitoringEmails.some(e => e === email)) {
            delete monitoringEmails[email];
            bot.sendMessage({
                to: channelID,
                message: `${email} has now been unsubscribed from Plex sever!`
            });
            updateSavedDataFile();
        } else {
            bot.sendMessage({
                to: channelID,
                message: 'Already unsubscribed from Plex server.'
            });
        }
    } else {
        bot.sendMessage({
            to: channelID,
            message: 'Invalid email address.'
        });
    }
}

function showRecentlyAddedMovies(channelID) {
    apiResource.getRecentlyAddedMovies(function (movies) {
        movies.forEach(function (movie) {
            bot.sendMessage({
                to: channelID,
                message: `----------------------------------------\n**Recently Added Movie** - ${movie.title}\n__*Year*__ : ${movie.year}\n__*Summary*__ : ||${movie.summary}||\n----------------------------------------`
            });
        });
    });
}

function showRecentlyAddedShows(channelID) {
    apiResource.getRecentlyAddedShows(function (shows) {
        shows.forEach(function (show) {
            if (show.grandparent_title === "") {
                bot.sendMessage({
                    to: channelID,
                    message: `----------------------------------------\n**Recently Added Series** - ${show.parent_title}\n__*Season*__ : ${show.title}\n----------------------------------------`
                });
            } else {
                bot.sendMessage({
                    to: channelID,
                    message: `----------------------------------------\n**Recently Added Episode** - ${show.grandparent_title}\n__*Title*__ : ${show.title}\n__*Season*__ : ${show.parent_title}\n__*Summary*__ : ||${show.summary}||\n----------------------------------------`
                });
            }
        });
    });
}

function showReport(channelID, timeFrame) {
    var days = 0;
    var reportType = "All Time";
    if (timeFrame === "day") {
        days = 1;
        reportType = "Daily";
    } else if (timeFrame === "week") {
        days = 7;
        reportType + "Weekly";
    } else if (timeFrame === "month") {
        days = 30;
        reportType = "Monthly";
    }
    apiResource.home_stats(days, function (stats_map) {
        var topMoviesMsg = "---------- Top Movies ----------\n";
        stats_map.get('topMovies').forEach(function (movie) {
            topMoviesMsg += `${movie.title} - Total Plays: ${movie.total_plays}\n`
        });
        topMoviesMsg += "--------------------------------\n";

        var popMoviesMsg = "---------- Popular Movies ----------\n";
        stats_map.get('popularMovies').forEach(function (movie) {
            popMoviesMsg += `${movie.title} - Users Watched: ${movie.users_watched}\n`
        });
        popMoviesMsg += "-------------------------------------\n";

        var topShowsMsg = "---------- Top Shows ----------\n";
        stats_map.get('topShows').forEach(function (show) {
            topShowsMsg += `${show.title} - Total Plays: ${show.total_plays}\n`
        });
        topShowsMsg += "-------------------------------------\n";

        var popShowsMsg = "---------- Popular Shows ----------\n";
        stats_map.get('popularShows').forEach(function (show) {
            popShowsMsg += `${show.title} - Number Users Watched: ${show.users_watched}\n`
        });
        popShowsMsg += "-------------------------------------\n";

        var topUsersMsg = "---------- Top Users -----------\n";
        stats_map.get('topUsers').forEach(function (user) {
            topUsersMsg += `${user.friendly_name} - Total Plays: ${user.total_plays}, Time Spent: ${msToTime(user.total_duration)}\n`
        });
        topUsersMsg += "-------------------------------------\n";
        bot.sendMessage({
            to: channelID,
            message: `${topMoviesMsg}`
        });
        bot.sendMessage({
            to: channelID,
            message: `${popMoviesMsg}\n`
        });
        bot.sendMessage({
            to: channelID,
            message: `${topShowsMsg}`
        });
        bot.sendMessage({
            to: channelID,
            message: `${popShowsMsg}\n`
        });
        bot.sendMessage({
            to: channelID,
            message: `${topUsersMsg}\n`
        });
    });
}

function showUserStats(channelID, username) {
    apiResource.user_stats(username, function (statsMap) {
        if (statsMap.size === 0) {
            bot.sendMessage({
                to: channelID,
                message: `User ${username} does not exist`
            });
        } else {
            var dayMsg = `Last 24 hours  : Total Time - ${msToTime(statsMap.get('dailyWatch').total_time)}, Total Plays - ${statsMap.get('dailyWatch').total_plays}\n`;
            var weekMsg = `Last 7 day     : Total Time - ${msToTime(statsMap.get('weeklyWatch').total_time)}, Total Plays - ${statsMap.get('weeklyWatch').total_plays}\n`;
            var monthMsg = `Last 30 days   : Total Time - ${msToTime(statsMap.get('monthlylWatch').total_time)}, Total Plays - ${statsMap.get('monthlylWatch').total_plays}\n`;
            var allTimeMsg = `All Time       : Total Time - ${msToTime(statsMap.get('allTimeWatch').total_time)}, Total Plays - ${statsMap.get('allTimeWatch').total_plays}\n`;
            var lastWatchedMsg = `Last 3 Watched: \n`;
            statsMap.get('lastWatched').forEach(function (data) {
                lastWatchedMsg += `\t${data.last_played}, Player: ${data.player}\n`
            });
            bot.sendMessage({
                to: channelID,
                message: `\`---------- User Stats for ${username} ----------\n${dayMsg}${weekMsg}${monthMsg}${allTimeMsg}${lastWatchedMsg}------------------------------\``
            });
        }
    });
}

function showUsers(channelID) {
    apiResource.getUsers(function (users) {
        var usersMsg = "";
        users.forEach(function (user) {
            usersMsg += `Username: ${user.friendly_name}, UserId: ${user.user_id}\n`
        });
        bot.sendMessage({
            to: channelID,
            message: usersMsg
        });
    });
}

function monitoringAction() {
    logger.info('monitoring');
    checkRecentMovies(function (newMovies) {
        newMovies.forEach(function (movie) {
            monitoringChannels.forEach(function (channelID) {
                var summary = "";
                if (movie.summary != "") {
                    summary = `__*Summary*__ : ||${movie.summary}||\n`
                }
                bot.sendMessage({
                    to: channelID,
                    message: `----------------------------------------\n**Movie Added** - ${movie.title}\n__*Year*__ : ${movie.year}\n${summary}----------------------------------------`
                });
            });
        });
        checkRecentShows(function (newShows) {
            newShows.forEach(function (show) {
                monitoringChannels.forEach(function (channelID) {
                    if (show.grandparent_title === "") {
                        bot.sendMessage({
                            to: channelID,
                            message: `----------------------------------------\n**New Series Added** - ${show.parent_title}\n__*Season*__ : ${show.title}\n----------------------------------------`
                        });
                    } else {
                        var summary = "";
                        if (show.summary != "") {
                            summary = `__*Summary*__ : ||${show.summary}||\n`
                        }
                        bot.sendMessage({
                            to: channelID,
                            message: `----------------------------------------\n**New Episode Added** - ${show.grandparent_title}\n__*Title*__ : ${show.title}\n__*Season*__ : ${show.parent_title}\n${summary}----------------------------------------`
                        });
                    }
                });
            });
            if (newMovies.size !== 0 || newShows.size !== 0) {
                createNewItemsMailOptions(newMovies, newShows, false, function (mailOptions) {
                    if (mailOptions != null) {
                        transporter.sendMail(mailOptions, function (err, info) {
                            if (err)
                                console.log(err);
                            else
                                console.log(info);
                        });
                    }
                    updateSavedDataFile()
                });
            }
        });
    });
}

function checkRecentMovies(callback) {
    apiResource.getRecentlyAddedMovies(function (movies) {
        var newMovies = compareAndGetNewElements(oldMovies, movies);
        oldMovies = movies;
        return callback(newMovies);
    });
}

function checkRecentShows(callback) {
    apiResource.getRecentlyAddedShows(function (shows) {
        var newShows = compareAndGetNewElements(oldShows, shows);
        oldShows = shows;
        return callback(newShows);
    });
}

function checkNewWeeklyMovies(callback) {
    apiResource.getRecentlyAddedMovies(function (movies) {
        var newMovies = compareAndGetNewElements(lastWeeksMovies, movies);
        lastWeeksMovies = movies;
        return callback(newMovies);
    });
}

function checkNewWeeklyShows(callback) {
    apiResource.getRecentlyAddedShows(function (shows) {
        var newShows = compareAndGetNewElements(lastWeeksShows, shows);
        lastWeeksShows = shows;
        return callback(newShows);
    });
}

function compareAndGetNewElements(oldSet, newSet) {
    var newElements = new Set();
    newSet.forEach(function (e) {
        newElements.add(e);
        oldSet.forEach(function (oldE) {
            if (oldE.rating_key === e.rating_key) {
                newElements.delete(e);
            }
        });
    });
    return newElements;
}

function createNewItemsMailOptions(movies, shows, testMode, callback) {
    var recipients = "";

    if (testMode)
        recipients = "jtollefson8@gmail.com";
    else {
        monitoringEmails.forEach(function (email) {
            recipients = recipients.concat(email, ',');
        });
        recipients = recipients.slice(0, -1);
    }

    newMoviesHtml(movies, function (movieSection) {
        newEpisodesAndShowsHtml(shows, function (showAndEpisodeSection) {
            var htmlBody = "";
            if (movieSection !== "" && showAndEpisodeSection !== "")
                htmlbody = "".concat(htmlResource.newItemsIntro(), movieSection, htmlResource.newItemsMiddle(), showAndEpisodeSection, htmlResource.newItemsEnd());
            else if (movieSection === "")
                htmlbody = "".concat(htmlResource.newItemsIntro(), showAndEpisodeSection, htmlResource.newItemsEnd());
            else if (showAndEpisodeSection === "")
                htmlbody = "".concat(htmlResource.newItemsIntro(), movieSection, htmlResource.newItemsEnd());
            else
                return callback(null);

            var mailOptions = {
                from: auth.email,
                bcc: recipients,
                subject: 'Deep Media Plex - New Items',
                html: htmlbody
            };
            return callback(mailOptions);
        });
    });
}


function updateSavedDataFile() {
    var validRequestNum = 100;
    if (requestNum)
        validRequestNum = requestNum;
    // requests.set(100, new PlexRequest(123, 345, "hii"));
    // requests.set(101, new PlexRequest(111, 999, "bye"));

    var json = {
        "notificaton_emails": monitoringEmails,
        "newsletter_emails": newsletterEmails,
        "channels": monitoringChannels,
        "oldMovies": Array.from(oldMovies),
        "oldShows": Array.from(oldShows),
        "requestNum": validRequestNum,
        "requests": Array.from(requests)
    };
    fs.writeFileSync('./savedData/savedData.json', JSON.stringify(json, null, 2));
}

function newMoviesHtml(movies, callback) {
    var moviesHtml = "";
    movies.forEach(function (movie) {
        var string = `<div class="gl-contains-text">
					<table width="100%" style="min-width: 100%;" cellpadding="0" cellspacing="0" border="0">
					<tbody>
					<tr>
					<td class="editor-text " align="left" valign="top" style="font-family: Arial, Verdana, Helvetica, sans-serif; font-size: 12px; color: #403F42; text-align: left; display: block; word-wrap: break-word; line-height: 1.2; padding: 10px 20px;">
					<div></div>
					<div class="text-container galileo-ap-content-editor"><div>
					<div><span style="font-weight: bold;">${movie.title} - ${movie.year}</span></div>
					<div>${movie.summary}</div>
					</div></div>
					</td>
					</tr>
					</tbody>
					</table>
					</div>`;
        moviesHtml = moviesHtml.concat(string);
    });
    if (moviesHtml === "")
        return callback("");
    var htmlString = "".concat(htmlResource.newMoviesStart(), moviesHtml, htmlResource.newMoviesEnd());
    return callback(htmlString);
}

function newEpisodesAndShowsHtml(shows, callback) {
    var showsHtml = "";
    var episodesHtml = "";

    if (shows.length === 0)
        return callback("");

    shows.forEach(function (show) {
        if (show.grandparent_title === "") {
            var parentTitle = "";
            if (show.parent_title !== "") {
                parentTitle = `${show.parentTitle} - `;
            }
            if (!parentTitle.startsWith("undefined") && !show.title.startsWith("undefined")) {
                var string = `<div class="gl-contains-text">
						<table width="100%" style="min-width: 100%;" cellpadding="0" cellspacing="0" border="0">
						<tbody>
						<tr>
						<td class="editor-text " align="left" valign="top" style="font-family: Arial, Verdana, Helvetica, sans-serif; font-size: 12px; color: #403F42; text-align: left; display: block; word-wrap: break-word; line-height: 1.2; padding: 10px 20px;">
						<div></div>
						<div class="text-container galileo-ap-content-editor"><div><div><span style="font-weight: bold;">${parentTitle}${show.title}</span></div></div></div>
						</td>
						</tr>
						</tbody>
						</table>
						</div>`;
                showsHtml = showsHtml.concat(string);
            }
        } else {
            var string = `<div class="gl-contains-text">
						<table width="100%" style="min-width: 100%;" cellpadding="0" cellspacing="0" border="0">
						<tbody>
						<tr>
						<td class="editor-text " align="left" valign="top" style="font-family: Arial, Verdana, Helvetica, sans-serif; font-size: 12px; color: #403F42; text-align: left; display: block; word-wrap: break-word; line-height: 1.2; padding: 10px 20px;">
						<div></div>
						<div class="text-container galileo-ap-content-editor"><div>
						<div><span style="color: rgb(45, 49, 51); font-weight: bold;">${show.grandparent_title} - ${show.title}</span></div>
						<div>
						<span style="color: rgb(45, 49, 51); font-weight: bold;">Season: </span><span style="color: rgb(45, 49, 51);">${show.parent_title}</span>
						</div>
						<div><span style="color: rgb(45, 49, 51);">${show.summary}</span></div>
						</div></div>
						</td>
						</tr>
						</tbody>
						</table>
						</div>`;
            episodesHtml = episodesHtml.concat(string);
        }
    });

    var htmlString = "";
    if (episodesHtml !== "" && showsHtml !== "")
        htmlString = "".concat(htmlResource.newShowsAndEpisodesStart(), htmlResource.newEpisodesStart(), episodesHtml, htmlResource.newShowsAndEpisodeMiddle(), htmlResource.newShowsStart(), showsHtml, htmlResource.newShowsAndEpisodesEnd());
    else if (episodesHtml === "")
        htmlString = "".concat(htmlResource.newShowsAndEpisodesStart(), htmlResource.newShowsStart(), showsHtml, htmlResource.newShowsAndEpisodesEnd());
    else if (showsHtml === "")
        htmlString = "".concat(htmlResource.newShowsAndEpisodesStart(), htmlResource.newEpisodesStart(), episodesHtml, htmlResource.newShowsAndEpisodesEnd());
    else
        htmlString = "";
    return callback(htmlString);
}

function createNewsletter() {
    checkNewWeeklyMovies(function (newMovies) {
        newMovies.forEach(function (movie) {

        });
        checkNewWeeklyShows(function (newShows) {
            newShows.forEach(function (show) {
                monitoringChannels.forEach(function (channelID) {
                    if (show.grandparent_title === "") {

                    } else {

                    }
                });
            });

        });
    });
}

function newsLetterMoviesHtml(newMovies, topMovies, callback) {
    var newMoviesHtml = "";
    newMovies.forEach(function (movie) {
        var genres = movie.genres.join(',');
        var string = `<div class="gl-contains-text">
					<table width="100%" style="min-width: 100%;" cellpadding="0" cellspacing="0" border="0">
					<tbody>
					<tr>
					<td class="editor-text " align="left" valign="top" style="font-family: Arial, Verdana, Helvetica, sans-serif; font-size: 12px; color: #403F42; text-align: left; display: block; word-wrap: break-word; line-height: 1.2; padding: 10px 20px;">
					<div></div>
					<div class="text-container galileo-ap-content-editor"><div>
					<div><span style="font-weight: bold;">${movie.title} - ${movie.year}</span></div>
					<div>Genres: ${genres}</div>
					</div></div>
					</td>
					</tr>
					</tbody>
					</table>
					</div>`;
        newMoviesHtml = newMoviesHtml.concat(string);
    });
    var topMoviesHtml = "";
    topMovies.forEach(function (movie) {
        var string = `<div class="gl-contains-text">
					<table width="100%" style="min-width: 100%;" cellpadding="0" cellspacing="0" border="0">
					<tbody>
					<tr>
					<td class="editor-text " align="left" valign="top" style="font-family: Arial, Verdana, Helvetica, sans-serif; font-size: 12px; color: #403F42; text-align: left; display: block; word-wrap: break-word; line-height: 1.2; padding: 10px 20px;">
					<div></div>
					<div class="text-container galileo-ap-content-editor"><div>
					<div><span style="font-weight: bold;">${movie.title} - ${movie.year}</span></div>
					<div>Total Plays: ${movie.total_plays}</div>
					</div></div>
					</td>
					</tr>
					</tbody>
					</table>
					</div>`;
        topMoviesHtml = topMoviesHtml.concat(string);
    });

    var htmlString = "".concat(htmlResource.newsLetterMoviesIntro(), newMoviesHtml, newsLetterMoviesFirstMid, topMoviesHtml, htmlResource.newsLetterMoviesEnd());
    return callback(htmlString);
}

function newsLetterShowssHtml(newMovies, topMovies, callback) {
    var newMoviesHtml = "";
    newMovies.forEach(function (movie) {
        var genres = movie.genres.join(',');
        var string = `<div class="gl-contains-text">
					<table width="100%" style="min-width: 100%;" cellpadding="0" cellspacing="0" border="0">
					<tbody>
					<tr>
					<td class="editor-text " align="left" valign="top" style="font-family: Arial, Verdana, Helvetica, sans-serif; font-size: 12px; color: #403F42; text-align: left; display: block; word-wrap: break-word; line-height: 1.2; padding: 10px 20px;">
					<div></div>
					<div class="text-container galileo-ap-content-editor"><div>
					<div><span style="font-weight: bold;">${movie.title} - ${movie.year}</span></div>
					<div>Genres: ${genres}</div>
					</div></div>
					</td>
					</tr>
					</tbody>
					</table>
					</div>`;
        newMoviesHtml = newMoviesHtml.concat(string);
    });
    var topMoviesHtml = "";
    topMovies.forEach(function (movie) {
        var string = `<div class="gl-contains-text">
					<table width="100%" style="min-width: 100%;" cellpadding="0" cellspacing="0" border="0">
					<tbody>
					<tr>
					<td class="editor-text " align="left" valign="top" style="font-family: Arial, Verdana, Helvetica, sans-serif; font-size: 12px; color: #403F42; text-align: left; display: block; word-wrap: break-word; line-height: 1.2; padding: 10px 20px;">
					<div></div>
					<div class="text-container galileo-ap-content-editor"><div>
					<div><span style="font-weight: bold;">${movie.title} - ${movie.year}</span></div>
					<div>Total Plays: ${movie.total_plays}</div>
					</div></div>
					</td>
					</tr>
					</tbody>
					</table>
					</div>`;
        topMoviesHtml = topMoviesHtml.concat(string);
    });

    var htmlString = "".concat(htmlResource.newsLetterMoviesIntro(), newMoviesHtml, newsLetterMoviesFirstMid, topMoviesHtml, htmlResource.newsLetterMoviesEnd());
    return callback(htmlString);
}

function msToTime(duration) {
    d = Number(duration);
    var h = Math.floor(d / 3600);
    var m = Math.floor(d % 3600 / 60);
    var s = Math.floor(d % 3600 % 60);

    var hDis = h < 10 ? "0" + h : h;
    var mDis = m < 10 ? "0" + m : m;
    var sDis = s < 10 ? "0" + s : s;
    return hDis + ":" + mDis + ":" + sDis;
}

function emailTest(arg) {
    if (arg == "movie_only") {
        createNewItemsMailOptions(oldMovies, [], true, function (mailOptions) {
            transporter.sendMail(mailOptions, function (err, info) {
                if (err)
                    console.log(err);
                else
                    console.log(info);
            });
        });
    } else if (arg == "shows_only") {
        createNewItemsMailOptions([], oldShows, true, function (mailOptions) {
            transporter.sendMail(mailOptions, function (err, info) {
                if (err)
                    console.log(err);
                else
                    console.log(info);
            });
        });
    } else {
        createNewItemsMailOptions(oldMovies, oldShows, true, function (mailOptions) {
            transporter.sendMail(mailOptions, function (err, info) {
                if (err)
                    console.log(err);
                else
                    console.log(info);
            });
        });
    }
}
