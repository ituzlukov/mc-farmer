const mineflayer = require('mineflayer');
const pathfinder = require('mineflayer-pathfinder').pathfinder;
const Movements = require('mineflayer-pathfinder').Movements;
const { GoalNear } = require('mineflayer-pathfinder').goals;

function createFarmerBot(options) {
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

    bot.allowLogging = true;
    bot.log = (message) => {
        if (bot.allowLogging) {
            console.log(message);
        }
    };

    bot.allowTalking = true;
    bot.talk = (message) => {
        if (bot.allowTalking) {
            bot.chat(message);
        }
    };

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


    bot.findVacantFarmlandBlock = (distance=16) => {

        let farmBlocksPos = bot.findBlocks({
            matching: (block) => {
                return block.name === "farmland";
            },
            count: 256,
            maxDistance: distance,
        });

        let vacantPos = farmBlocksPos.find(position => {
            let topBlock = bot.blockAt(position.offset(0, 1, 0));
            return topBlock.name === "air" || topBlock.name === "cave_air";
        });

        if (!vacantPos) {
            return null;
        }

        return bot.blockAt(vacantPos);
    };

    bot.collectNearestItems = async (numItemsToCollect=16) => {
        for(let i = 0; i < numItemsToCollect; i++){
			let itemEntity = bot.nearestEntity((entity) => {
				return entity.name.toLowerCase() === 'item'
			});
		
			if (itemEntity) {
				await bot.goToPos(itemEntity.position);
				await bot.waitForTicks(1);
                ++numItemsCollected;
			}
			else {
				break;
			}
		}
    };


    return bot;
}

module.exports = { createFarmerBot }
