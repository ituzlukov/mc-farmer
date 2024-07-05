const mineflayer = require('mineflayer');
const pathfinder = require('mineflayer-pathfinder').pathfinder;
const Movements = require('mineflayer-pathfinder').Movements;
const { GoalNear } = require('mineflayer-pathfinder').goals;

function create(options) {
    const bot = mineflayer.createBot(options);

    bot.once('spawn', async () => {

        bot.loadPlugin(pathfinder);
        
        const botMovements = new Movements(bot);
        botMovements.canDig = false;
        botMovements.allowParkour = false;
        botMovements.allowSprinting = false;
        botMovements.canOpenDoors = false;

        bot.pathfinder.setMovements(botMovements);
    });

    bot.goToPos = async (target, range = 1) => {

        if (bot.pathfinder.isMoving()) {
            console.warn(`failed to go to ${target} cause bot is still moving!`);
            return false;
        }

        //console.log(`go to -> ${target}`);

        const targetGoal = new GoalNear(target.x, target.y, target.z, range);

        const foundPath = bot.pathfinder.getPathTo(bot.pathfinder.movements, targetGoal);
        if (foundPath.status != 'success') {
            console.warn(`no path found to pos ${target}`);
            return false;
        }

        bot.setControlState('sprint', false);

        let reached = false;
        await bot.pathfinder.goto(targetGoal)
            .then (
                () => { 
                    //console.log(`reached -> ${target}`);
                     reached = true; },
                (err) => { console.error(`${target} ${err}`, err); } );

        return reached;
    };

    return bot;
}

module.exports = { create }