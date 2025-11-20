const games = {};

// creates a game object for the given channel
module.exports.startGame = function startGame(channelId, topic, startVotingFunction, timeouts) {
  games[channelId] = {
    topic,
    submissions: [],
    optedOut: [],
    voting: false,
    ended: false,
    startVotingFunction,
    timeouts,
   };
  return games[channelId];
}

// checks if a game is currently running in the given channel
module.exports.checkGame = function checkGame(channelId) {
  return games[channelId] ?? null;
}

// marks a game as complete and removes it from the game list
module.exports.finishGame = function finishGame(channelId) {
  if (!(channelId in games)) return false;
  games[channelId].ended = true;
  delete games[channelId];
  return true;
}

// forces voting to start for a given channel's game, regardless of the 5 minute timer
module.exports.forceStartVoting = async function forceStartVoting(channelId) {
  if (!(channelId in games)) return false;
  const game = games[channelId];
  for (const timeout of game.timeouts)
    clearTimeout(timeout);
  await game.startVotingFunction();
  return true;
}