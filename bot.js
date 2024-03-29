const fs = require('fs');
const ip = require('ip');
const Discord = require('discord.js');
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
        "requests": JSON.stringify([...(new Map())]),
		"movieFileMessages": JSON.stringify([...(new Map())]),
		"movieFileSets": [],
		"tvShowMessages": []
    };
    fs.mkdir('./savedData', { recursive: true }, (err) => {if (err) throw err;});
    fs.writeFileSync('./savedData/savedData.json', JSON.stringify(json, null, 2));
}

const savedData = require('./savedData/savedData.json');
const apiResource = require('./apiResource.js');
const htmlResource = require('./htmlResource.js');
const embedResource = require('./embedResource.js');

class PlexRequest {
    constructor(message, request) {
        this.message = message;
        this.request = request;
    }
}

class MovieFileInfo {
    constructor(guid, indexerId) {
        this.guid = guid;
        this.indexerId = indexerId;
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

var monitoringChannels = new Set(savedData.channels);
var monitoringEmails = new Set(savedData.notificaton_emails);
var newsletterEmails = new Set(savedData.newsletter_emails);

var requestNum = savedData.requestNum;
var movieFileMessages = new Map(savedData.movieFileMessages);
var movieFileSets = new Set(savedData.movieFileSets);
var tvShowMessages = new Map(savedData.tvShowMessages);
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
const bot = new Discord.Client();

bot.on('ready', function (evt) {
    logger.info('Connected');
    logger.info('Logged in as: ');
    logger.info(bot.user.tag);
    setInterval(function () {
        monitoringAction()
    }, 1000 * 60 * 60 * 24);
    // setInterval(function(){monitoringAction()}, 3000);
});

bot.login(auth.token);
bot.users.fetch('116976756581203972');
bot.users.fetch('139462400658112513');

bot.on('disconnect', function(erMsg, code) {
    console.log('----- Bot disconnected from Discord with code', code, 'for reason:', erMsg, '-----');
    bot.connect();
});

bot.on('message', msg => {
	const user = msg.author;
	const channel = msg.channel;
	const message = msg.content;
	
    // It will listen for messages that will start with `~`
    if (message.substring(0, 1) === '~') {
        var args = message.substring(1).split(' ');
        var cmd = args[0];

        args = args.splice(1);
        switch (cmd) {
            case 'request':
                sendRequest(channel, user.username, args.join(' '), false, "");
                break;
			case 'request_movie':
                sendMovieRequest(channel, user, args.join(' '), false);
                break;
            case 'request_show':
                sendShowRequest(channel, user, args.join(' '), false);
                break;
			case 'request_test':
                sendRequest(channel, user.username, args.join(' '), true, "");
                break;
			case 'request_movie_test':
                sendMovieRequest(channel, user, args.join(' '), true);
                break;
			case 'request_show_test':
                sendShowRequest(channel, user, args.join(' '), true);
                break;
            case 'latest_movies':
                showRecentlyAddedMovies(channel);
                break;
            case 'latest_shows':
                showRecentlyAddedShows(channel);
                break;
            case 'start_monitor':
                startMonitoring(channel);
                break;
            case 'stop_monitor':
                stopMonitoring(channel);
                break;
            case 'subscribe':
                subscribe(channel, args.join(' '));
                break;
            case 'unsubscribe':
                unsubscribe(channel, args.join(' '));
                break;
            case 'help':
				channel.send(embedResource.embedHelp(bot));
                break;
            case 'report':
                if (args.length !== 0) {
                    showReport(channel, args[0]);
                } else {
                    showReport(channel, "alltime");
                }
                break;
            case 'user_stats':
                showUserStats(channel, args.join(' '));
                break;
            case 'users':
                showUsers(channel);
                break;
            case 'ip':
                channel.send(`IP Address where PlexBot is running is ${ip.address()}`);
                break;
            case 'crash_bot':
                channel.send('Crashing Bot ...');
                crashingBotVariable.add(channel);
                break;
            case 'bot_last_updated':
                channel.send('Bot was last updated on April 6th 2020 at 11:45 German Time :mag:');
                break;
            case 'trigger_email':
                emailTest(args.join(' '));
                channel('Sent test email to Jonah');
                break
			case 'triger_monitor_check':
                monitoringAction();
                break;
        }
    }
});

bot.on('messageReactionAdd', (reaction, user) => {
	try {
		if (!reaction.me && requests.has(reaction.message.id)) {
			const requestPlex = requests.get(reaction.message.id);
			requestPlex.message.react(reaction.emoji);
		} else if (!reaction.me && movieFileMessages.has(reaction.message.id) && reaction.emoji.name === '⬇️') {
			apiResource.downloadRadarrMovie(movieFileMessages.get(reaction.message.id), function (downloaded) {
				if (downloaded) {
					reaction.message.react('✅');
				}
				var fileSetToRemove = null;
				movieFileSets.forEach( function(fileSet) {
					fileSet.forEach ( function (fileMsg) {
						if (fileMsg.id !== reaction.message.id) {
							fileSetToRemove = fileSet;
							fileMsg.delete();
						}
					});
				});
				if (fileSetToRemove !== null) {
					movieFileSets.delete(fileSetToRemove);
					updateSavedDataFile();
				}
			});
		} else if (!reaction.me && tvShowMessages.has(reaction.message.id) && reaction.emoji.name === '⬇️') {
			apiResource.addMedusaShow(tvShowMessages.get(reaction.message.id), function (added) {
				if (added) {
					reaction.message.react('✅');
				}
			});
		}
	} catch (e) {
		console.log(e);
	}
});

bot.on('messageReactionRemove', (reaction, user) => {
	try {
		if (requests.has(reaction.message.id)) {
			const requestPlex = requests.get(reaction.message.id);
			requestPlex.message.reactions.cache.find(r => r.emoji.name == reaction.emoji.name).remove();
		} 
	} catch (e) {
		console.log(e);
	}
});


// Slides a plex request into Will's DMs
function sendRequest(channel, username, request, test, failed) {
    var adminID = "116976756581203972";
    if (test) {
        adminID = "139462400658112513";
    }
	var failText = "";
	if (failed === "movie") {
		failText = "Failed to find Movie results\n"
	} else if (failed === "show") {
		failText = "Failed to find Show results.\n"
	}		
	channel.send(
		`${failText}Request "${request}" sent to Plex Admin.`
	).then(requestMessage => {
		bot.users.cache.get(adminID).send(
			`${failText}From: ${username}\nPlex Request: ${request}`
		).then(message => {
			requests.set(message.id, new PlexRequest(requestMessage, request));
			if (requestNum === 999)
				requestNum = 100;
			else
				requestNum++;
			updateSavedDataFile();
		});
	});
}

function sendMovieRequest(channel, userObj, request, test) {
    var adminID = "116976756581203972";
    if (test) {
        adminID = "139462400658112513";
    }
	apiResource.searchRadarrMovie(request, function (movieResults) {
		var movies = new Set();
		movieResults.forEach(function(movie) {movies.add(movie);});
		if (movieResults !== undefined && movieResults.length !== undefined && movieResults.length !== 0) {
			channel.send('Please select correct Movie').then(originalRequest => {
				var num = 3;
				const filter = (reaction, user) => {
					return '👍' === reaction.emoji.name && user.id === userObj.id;
				};
				const messagesToDelete = new Set();
				movies.forEach(function (movie) {
					if (num > 0) {
						num = num-1;
						if (movie.hasFile || movie.monitored) {
							apiResource.searchMovieByName(movie.title, function (foundMovies) {
								if (foundMovies.size !== 0) {
									var movieValues = foundMovies.values();
									var first = movieValues.next().value
									channel.send(embedResource.embedRadarrMovie(bot, movie, first.rating_key)).then(message => {
										messagesToDelete.add(message);
										message.delete({timeout: 60000*5})
											.then(msg => console.log(`Deleted message from ${msg.author.username}`))
											.catch(console.error);
									});
								} else {
									channel.send(embedResource.embedRadarrMovie(bot, movie)).then(message => {
										messagesToDelete.add(message);
										message.delete({timeout: 60000*5})
											.then(msg => console.log(`Deleted message from ${msg.author.username}`))
											.catch(console.error);
									});
								}
							});
						} else {
							channel.send(embedResource.embedRadarrMovie(bot, movie)).then(message => {
								messagesToDelete.add(message);
								message.react('👍');
								message.awaitReactions(filter, { max: 1, time: 60000*5, errors: ['time'] })
									.then(collected => {
										const reactionMessage = collected.first().message;
										apiResource.addRadarrMovie(movie, function (addedMovie) {
											if(addedMovie.id !== undefined) {
												try {
													messagesToDelete.forEach(function (msg) {
														if (msg.id !== reactionMessage.id) {
															msg.delete();
														}
													});
												} catch (e) {
													console.log(e);
												}
												reactionMessage.react('✅');
												bot.users.cache.get(adminID).send(
													`From: ${userObj.username} - Plex Request: ${request}`
													).then(requestMessage => {
													apiResource.getRadarrMovieFiles(addedMovie.id, function (movieFiles) {
														var adminNum = 4;
														movieFiles.forEach(function (movieFile) {
															try {
																if (adminNum > 0) {
																	adminNum = adminNum-1;
																	const fileSet = new Set();
																	bot.users.cache.get(adminID).send(embedResource.embedRadarrMovieFile(bot, movieFile)).then(movieFileMessage => {
																		movieFileMessage.react('⬇️');
																		movieFileMessages.set(movieFileMessage.id, new MovieFileInfo(movieFile.guid, movieFile.indexerId));
																		fileSet.add(movieFileMessage);
																	});
																	movieFileSets.add(fileSet);
																}
															} catch (e) {
																console.log(e);
															}
														});
														requests.set(requestMessage.id, new PlexRequest(originalRequest, request));
														if (requestNum === 999)
															requestNum = 100;
														else
														requestNum++;
														updateSavedDataFile();
													});
												});
											} else {
												bot.users.cache.get(adminID).send(
													`From: ${userObj.username} - Plex Request: ${request}`
												).then(requestMessage => {
													requests.set(requestMessage.id, new PlexRequest(originalRequest, request));
													if (requestNum === 999)
														requestNum = 100;
													else
														requestNum++;
													updateSavedDataFile();
												});
											}
										});
									}).catch(collected => {
										message.delete()
										.then(msg => console.log(`Deleted message from ${msg.author.username}`))
										.catch(console.error);
									});
							});
						}
					}
				});
			});
		} else {
			sendRequest(channel, userObj.username, request, test, "movie");
		}
	});
}

function sendShowRequest(channel, userObj, request, test) {
    var adminID = "116976756581203972";
    if (test) {
        adminID = "139462400658112513";
    }
	apiResource.searchTMDBShow(request, function (shows) {
		if (shows !== undefined && shows.length !== undefined && shows.length !== 0) {
			channel.send('Please select correct Show').then(originalRequest => {
				var num = 3;
				const filter = (reaction, user) => {
					return '👍' === reaction.emoji.name && user.id === userObj.id;
				};
				const messagesToDelete = new Set();
				shows.forEach(function (show) {
					if (num > 0) {
						num = num-1;
						apiResource.searchShowByName(show.name, function (foundShows) {
							if (foundShows.size !== 0) {
								var showValues = foundShows.values();
								var first = showValues.next().value;
								channel.send(embedResource.embedTMDBShow(bot, show, true, first.rating_key)).then(message => {
									messagesToDelete.add(message);
									message.delete({timeout: 60000*5})
										.then(msg => console.log(`Deleted message from ${msg.author.username}`))
										.catch(console.error);
								});
							} else {
								channel.send(embedResource.embedTMDBShow(bot, show, false)).then(message => {
									messagesToDelete.add(message);
									message.react('👍');
									message.awaitReactions(filter, { max: 1, time: 60000*5, errors: ['time'] }).then(collected => {
										try {
											const reactionMessage = collected.first().message;
											messagesToDelete.forEach(function (msg) {
												if (msg.id !== reactionMessage.id) {
													msg.delete();
												}
											});
											reactionMessage.react('✅');
										} catch(e) {
											console.log(e);
										}
										bot.users.cache.get(adminID).send(
											`From: ${userObj.username} - Plex Request: ${request}`
										).then(requestMessage => {
											bot.users.cache.get(adminID).send(embedResource.embedTMDBShow(bot, show, false)).then(confirmMessage => {
												confirmMessage.react('⬇️');
												tvShowMessages.set(confirmMessage.id, show.id);
												requests.set(requestMessage.id, new PlexRequest(originalRequest, request));
												if (requestNum === 999)
													requestNum = 100;
												else
													requestNum++;
												updateSavedDataFile();
											});
										});
									}).catch(collected => {
										message.delete()
										.then(msg => console.log(`Deleted message from ${msg.author.username}`))
										.catch(console.error);
									});;
								});
							}
						});
					}
				});
			});
		} else {
			sendRequest(channel, userObj.username, request, test, "show");
		}
	});
}

function statusUpdate(message, reaction) {
	if (requests.has(message.id)) {
		const requestPlex = requests.get(message.id);
		requestPlex.message.react(reaction.emoji.name);
	} 
}

function startMonitoring(channel) {
	const channelID = channel.id;
    if (!monitoringChannels.has(channelID)) {
        monitoringChannels.add(channelID);
        channel.send('Now monitoring Plex server for newly added movies and shows.');
        updateSavedDataFile();
    } else {
        channel.send('Monitoring for Plex server has already been started.');
    }
}

function stopMonitoring(channel) {
	const channelID = channel.id;
    if (monitoringChannels.has(channelID)) {
        monitoringChannels.delete(channelID);
        channel.send('Monitoring for Plex server has stopped.');
        updateSavedDataFile();
    } else {
        channel.send('Monitoring for Plex server is already stopped.');
    }
}

function subscribe(channel, email) {
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        if (!monitoringEmails.has(email)) {
            monitoringEmails.add(email);
            channel.send(`${email} is now subscribed to Plex sever!`);
            updateSavedDataFile();
        } else {
            channel.send('Already subscribed to Plex server.');
        }
    } else {
        channel.send('Invalid email address.');
    }
}

function unsubscribe(channel, email) {
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        if (monitoringEmails.has(email)) {
            monitoringEmails.delete(email);
            channel.send(`${email} has now been unsubscribed from Plex sever!`);
            updateSavedDataFile();
        } else {
            channel.send('Already unsubscribed to Plex server.');
        }
    } else {
        channel.send('Invalid email address.');
    }
}

function showRecentlyAddedMovies(channel) {
    var num = 5
	apiResource.getRecentlyAddedMovies(function (movies) {
        movies.forEach(function (movie) {
			if (num > 0) {
				num = num - 1;
				channel.send(embedResource.embedPlexMovie(bot, movie));
			}
        });
    });
}

function showRecentlyAddedShows(channel) {
	var num = 5
    apiResource.getRecentlyAddedShows(function (shows) {
        shows.forEach(function (show) {
			if (num > 0) {
				num = num - 1;
				if (show.media_type === "episode") {
					channel.send(embedResource.embedPlexEpisode(bot, show));
				} else if (show.media_type === "show") {
					channel.send(embedResource.embedPlexShow(bot, show));
				} else if (show.media_type === "season") {
					channel.send(embedResource.embedPlexSeason(bot, show));
				}
			}
        });
    });
}

function showReport(channel, timeFrame) {
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
        channel.send(`${topMoviesMsg}`);
		channel.send(`${popMoviesMsg}`);
        channel.send(`${topShowsMsg}`);
        channel.send(`${popShowsMsg}`);
        channel.send(`${topUsersMsg}`);
    });
}

function showUserStats(channel, username) {
    apiResource.user_stats(username, function (statsMap) {
        if (statsMap.size === 0) {
            channel.send(`User ${username} does not exist`);
        } else {
            var dayMsg = `Last 24 hours  : Total Time - ${msToTime(statsMap.get('dailyWatch').total_time)}, Total Plays - ${statsMap.get('dailyWatch').total_plays}\n`;
            var weekMsg = `Last 7 day     : Total Time - ${msToTime(statsMap.get('weeklyWatch').total_time)}, Total Plays - ${statsMap.get('weeklyWatch').total_plays}\n`;
            var monthMsg = `Last 30 days   : Total Time - ${msToTime(statsMap.get('monthlylWatch').total_time)}, Total Plays - ${statsMap.get('monthlylWatch').total_plays}\n`;
            var allTimeMsg = `All Time       : Total Time - ${msToTime(statsMap.get('allTimeWatch').total_time)}, Total Plays - ${statsMap.get('allTimeWatch').total_plays}\n`;
            var lastWatchedMsg = `Last 3 Watched: \n`;
            statsMap.get('lastWatched').forEach(function (data) {
                lastWatchedMsg += `\t${data.last_played}, Player: ${data.player}\n`
            });
            channel.send(
				`\`---------- User Stats for ${username} ----------\n${dayMsg}${weekMsg}${monthMsg}${allTimeMsg}${lastWatchedMsg}------------------------------\``
            );
        }
    });
}

function showUsers(channel) {
    apiResource.getUsers(function (users) {
        var usersMsg = "";
        users.forEach(function (user) {
            usersMsg += `Username: ${user.friendly_name}, UserId: ${user.user_id}\n`
        });
        channel.send(usersMsg);
    });
}

function monitoringAction() {
    logger.info('monitoring');
    checkRecentMovies(function (newMovies) {
        newMovies.forEach(function (movie) {
            monitoringChannels.forEach(function (channelID) {
				const channel = bot.channels.cache.find(channel => channel.id === channelID)
                channel.send(embedResource.embedPlexMovie(bot, movie));
            });
        });
        checkRecentShows(function (newShows) {
            newShows.forEach(function (show) {
                monitoringChannels.forEach(function (channelID) {
					const channel = bot.channels.cache.find(channel => channel.id === channelID)
                    if (show.media_type === "episode") {
                        channel.send(embedResource.embedPlexEpisode(bot, show));
                    } else if (show.media_type === "show") {
                        channel.send(embedResource.embedPlexShow(bot, show));
                    } else if (show.media_type === "season") {
						channel.send(embedResource.embedPlexSeason(bot, show));
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
        "notificaton_emails": Array.from(monitoringEmails),
        "newsletter_emails": Array.from(newsletterEmails),
        "channels": Array.from(monitoringChannels),
        "oldMovies": Array.from(oldMovies),
        "oldShows": Array.from(oldShows),
        "requestNum": validRequestNum,
        "requests": Array.from(requests),
		"movieFileMessages": Array.from(movieFileMessages),
		"movieFileSets": Array.from(movieFileSets),
		"tvShowMessages": Array.from(tvShowMessages)
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
		if (show.media_type === "episode") {
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
		} else if (show.media_type === "show") {
			var string = `<div class="gl-contains-text">
						<table width="100%" style="min-width: 100%;" cellpadding="0" cellspacing="0" border="0">
						<tbody>
						<tr>
						<td class="editor-text " align="left" valign="top" style="font-family: Arial, Verdana, Helvetica, sans-serif; font-size: 12px; color: #403F42; text-align: left; display: block; word-wrap: break-word; line-height: 1.2; padding: 10px 20px;">
						<div></div>
						<div class="text-container galileo-ap-content-editor"><div><div><span style="font-weight: bold;">${show.title}</span></div></div></div>
						</td>
						</tr>
						</tbody>
						</table>
						</div>`;
                showsHtml = showsHtml.concat(string);
		} else if (show.media_type === "season") {
			var string = `<div class="gl-contains-text">
						<table width="100%" style="min-width: 100%;" cellpadding="0" cellspacing="0" border="0">
						<tbody>
						<tr>
						<td class="editor-text " align="left" valign="top" style="font-family: Arial, Verdana, Helvetica, sans-serif; font-size: 12px; color: #403F42; text-align: left; display: block; word-wrap: break-word; line-height: 1.2; padding: 10px 20px;">
						<div></div>
						<div class="text-container galileo-ap-content-editor"><div><div><span style="font-weight: bold;">${show.parent_title} - ${show.title}</span></div></div></div>
						</td>
						</tr>
						</tbody>
						</table>
						</div>`;
                showsHtml = showsHtml.concat(string);
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
