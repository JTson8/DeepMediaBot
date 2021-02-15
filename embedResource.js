const config = require('./savedData/config.json');
const radarrConfig = require('./savedData/radarrConfig.json');
const medusaConfig = require('./savedData/medusaConfig.json');
const logger = require('winston');

function embedPlexShow(bot, show) {
	var summary = "";
	if (show.summary != "") {
		summary = `||${show.summary}||`
	}
	
	var thumbImage = ""
	if (show.art !== "") {
		thumbImage = `${config.host}:${config.port}/pms_image_proxy?img=${show.art}.png`
	} else {
		thumbImage = `${config.host}:${config.port}/pms_image_proxy?img=${show.thumb}.png`
	}
	return ({
		embed: {
			color: 3447003,
			author: {
			  name: bot.user.username,
			  icon_url: 'https://styles.redditmedia.com/t5_2ql7e/styles/communityIcon_mdwl2x2rtzb11.png'
			},
			title: `New Show! - ${show.title}`,
			description: summary,
			thumbnail: {
				url: thumbImage
			},
			fields: [
				{
					name: "Year",
					value: ((show.year !== "") ? show.year : "null"),
					inline: true
				}
			],
			timestamp: new Date(),
			footer: {
				icon_url: bot.user.avatarURL
			}
		}
	});
}

function embedPlexSeason(bot, season) {
	var thumbImage = ""
	if (season.art !== "") {
		thumbImage = `${config.host}:${config.port}/pms_image_proxy?img=${season.art}`
	} else {
		thumbImage = `${config.host}:${config.port}/pms_image_proxy?img=${season.thumb}`
	}
	return ({
		embed: {
			color: 3447003,
			author: {
			  name: bot.user.username,
			  icon_url: 'https://styles.redditmedia.com/t5_2ql7e/styles/communityIcon_mdwl2x2rtzb11.png'
			},
			title: `New Season! - ${season.parent_title}`,
			description: season.title,
			thumbnail: {
				url: thumbImage
			},
			timestamp: new Date(),
			footer: {
				icon_url: bot.user.avatarURL
			}
		}
	});
}

function embedPlexEpisode(bot, episode) {
	var summary = "";
	if (episode.summary != "") {
		summary = `||${episode.summary}||`
	}
	
	var thumbImage = ""
	if (episode.art !== "") {
		thumbImage = `${config.host}:${config.port}/pms_image_proxy?img=${episode.art}`
	} else {
		thumbImage = `${config.host}:${config.port}/pms_image_proxy?img=${episode.thumb}`
	}
	return ({
		embed: {
			color: 3447003,
			author: {
			  name: bot.user.username,
			  icon_url: 'https://styles.redditmedia.com/t5_2ql7e/styles/communityIcon_mdwl2x2rtzb11.png'
			},
			title: `New Episode! - ${episode.full_title}`,
			description: summary,
			thumbnail: {
				url: thumbImage
			},
			fields: [
				{
					name: "Show",
					value: ((episode.grandparent_title !== "") ? episode.grandparent_title : "null"),
				},
				{
					name: "Season",
					value: ((episode.parent_title !== "") ? episode.parent_title : "null"),
					inline: true
				},
				{
					name: "Year",
					value: ((episode.year !== "") ? episode.year : "null"),
					inline: true
				}
			],
			timestamp: new Date(),
			footer: {
				icon_url: bot.user.avatarURL
			}
		}
	});
}

function embedPlexMovie(bot, movie) {
	var summary = "";
	if (movie.summary != "") {
		summary = `||${movie.summary}||`
	}
	
	var thumbImage = ""
	if (movie.art !== "") {
		thumbImage = `${config.host}:${config.port}/pms_image_proxy?img=${movie.art}.png`
	} else {
		thumbImage = `${config.host}:${config.port}/pms_image_proxy?img=${movie.thumb}.png`
	}
	logger.info(thumbImage);
	return ({
		embed: {
			color: 3447003,
			author: {
			  name: bot.user.username,
			  icon_url: 'https://styles.redditmedia.com/t5_2ql7e/styles/communityIcon_mdwl2x2rtzb11.png'
			},
			title: `New Movie! - ${movie.title}`,
			description: summary,
			thumbnail: {
				url: thumbImage
			},
			fields: [
				{
					name: "Year",
					value: ((movie.year !== "") ? movie.year : "null")
				}
			],
			timestamp: new Date(),
			footer: {
				icon_url: bot.user.avatarURL
			}
		}
	});
}

function embedHelp(bot) {
	return ({
		embed: {
			color: 3447003,
			author: {
			  name: bot.user.username,
			  icon_url: 'https://styles.redditmedia.com/t5_2ql7e/styles/communityIcon_mdwl2x2rtzb11.png'
			},
			title: `**Welcome!** I am the Deep Media Plex Bot!`,
			description: `My current duties are to provide recently added shows and movies.\n All commands must start with \'~\'\n**Commands**`,
			fields: [
				{
					name: "request [text]",
					value: "Slides a Plex request into the Will's DMs. Can add any text to describe a request"
				},
				{
					name: "request_movie [text]",
					value: "Gives back possible movie matches based on the given request. Select the wanted movie by reacting with 👍. Request will then be sent to Will's DMs."
				},
				{
					name: "request_show [text]",
					value: "Gives back possible show matches based on the given request. Select the wanted show by reacting with 👍. Request will then be sent to Will's DMs."
				},
				{
					name: "latest_movies",
					value: "Get information on the last 5 added movies"
				},
				{
					name: "latest_shows",
					value: "Get information on the last 5 added shows/episodes"
				},
				{
					name: "start_monitor",
					value: "Starts monitoring for this channel. I will send messages whenever a new movie, show or episode is added"
				},
				{
					name: "stop_monitor",
					value: "Stops monitoring for this channel"
				},
				{
					name: "subscribe [email address]",
					value: "Subscribes that email to a get notifications when new things are added"
				},
				{
					name: "unsubscribe [email address]",
					value: "Unsubscribes email address from mailing list"
				},
				{
					name: "report [alltime, day, week, month]",
					value: "Gives a stat report within the given time frame"
				},
				{
					name: "user_stats [username]",
					value: "Gives stats on the given user"
				},
				{
					name: "users ",
					value: "Gives list of all users and their ids"
				}
			],
			timestamp: new Date(),
			footer: {
				icon_url: bot.user.avatarURL
			}
		}
	});
}

function embedRadarrMovie(bot, movie) {
	var imageUrl = "";
	if (movie.images !== undefined && movie.images.length !== 0) {
		imageUrl = movie.images[0].remoteUrl;
	}
	return(
		{
			embed: {
				color: 3447003,
				author: {
				  name: bot.user.username,
				  icon_url: 'https://styles.redditmedia.com/t5_2ql7e/styles/communityIcon_mdwl2x2rtzb11.png'
				},
				title: movie.title,
				description: `||${movie.overview}||`,
				thumbnail: {
					url: imageUrl 
				},
				fields: [{
					name: "Year",
					value: ((movie.year !== "") ? movie.year : "null")
				  },
				  {
					name: "On Plex",
					value: ((movie.hasFile === true) ? "Yes" : "No"),
					inline: true
				  },
				  {
					name: "Already Searching",
					value: ((movie.monitored === true) ? "Yes" : "No"),
					inline: true
				  }
				],
				timestamp: new Date(),
				footer: {
				  icon_url: bot.user.avatarURL
				}
			}
		}
	)
}

function embedRadarrMovieFile(bot, movie) {
	const quality = `${movie.quality.quality.source} - ${movie.quality.quality.resolution}`
	const size = movie.size / 1000000000;
	return(
		{
			embed: {
				color: 3447003,
				author: {
				  name: bot.user.username,
				  icon_url: 'https://styles.redditmedia.com/t5_2ql7e/styles/communityIcon_mdwl2x2rtzb11.png'
				},
				title: movie.movieTitle,
				description: movie.title,
				fields: [{
					name: "Size",
					value: `${size} GB`,
					inline: true
				  },
				  {
					name: "Quality",
					value: quality,
					inline: true
				  },
				  {
					name: "Torrent",
					value: movie.guid
				  }
				],
				timestamp: new Date(),
				footer: {
				  icon_url: bot.user.avatarURL
				}
			}
		}
	)
}

function embedTMDBShow(bot, show, added) {
	var imageUrl = "";
	if (show.poster_path !== null && show.poster_path.length !== 0) {
		imageUrl = `https://www.themoviedb.org/t/p/w58_and_h87_face/${show.poster_path}`
	} else if (show.backdrop_path !== null && show.backdrop_path.length !== 0) {
		imageUrl = `https://www.themoviedb.org/t/p/w58_and_h87_face/${show.backdrop_path}`
	}
	return(
		{
			embed: {
				color: 3447003,
				author: {
				  name: bot.user.username,
				  icon_url: 'https://styles.redditmedia.com/t5_2ql7e/styles/communityIcon_mdwl2x2rtzb11.png'
				},
				title: show.name,
				description: ((show.overview !== "") ? `||${show.overview}||` : "null"),
				thumbnail: {
					url: imageUrl 
				},
				fields: [{
					name: "Air Date",
					value: ((show.first_air_date !== "") ? show.first_air_date : "null"),
					inline: true
				  },
				  {
					name: "On Plex",
					value: ((added === true) ? "Yes" : "No"),
					inline: true
				  }
				],
				timestamp: new Date(),
				footer: {
				  icon_url: bot.user.avatarURL
				}
			}
		}
	)
}

module.exports = {embedPlexShow, embedPlexSeason, embedPlexEpisode, embedPlexMovie, embedHelp, embedRadarrMovie, embedRadarrMovieFile, embedTMDBShow}