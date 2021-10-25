import loki = require("lokijs");
import { AccountId } from '@parallel-finance/types/interfaces'
import * as model from "./model";
import { logger } from "./logger";

export class Database {
    private db: Loki;
    private borrowers: Collection<model.LiquidationTask>;

    constructor(filename?: string) {
        let db = new loki(filename ? filename : "liquidation.json", {
            autosave: true,
            autosaveInterval: 100,
            autoload: true,
            autoloadCallback: onAutoLoad
        });
        const self = this;

        function onAutoLoad() {
            let borrowers = db.getCollection<model.LiquidationTask>("borrowers")
            if (!borrowers) {
                borrowers = db.addCollection<model.LiquidationTask>("borrowers");
                console.log("Database not found. Adding the borrowers collection.");
            } else {
                logger.debug("Reload Liquidation Database.");
            }
            self.borrowers = borrowers;
        };

        this.db = db;
    }

    getFirstBorrower(): AccountId {
        return this.borrowers.data[0].borrower as unknown as AccountId
    }

    getFirstBorrowers(): model.LiquidationTask[] {
        this.borrowers.data[0].borrower;
        return this.borrowers.data;
    }

    addTask(task: model.LiquidationTask) {
        const result = this.borrowers.find({ borrower: { '$eq': task.borrower } });
        if (result.length) {
            logger.debug('borrower already stored: ', task.borrower.toString())
        } else {
            logger.debug('insert borrower: ', task.borrower.toString())
            this.borrowers.insert(task);
        }
    }

    removeTask(task: model.LiquidationTask): void {
        logger.debug('remove task: ', task.borrower.toString())
        this.borrowers.remove(task)
    }
    
    removeBorrower(borrower: String): void {
        this.borrowers.findAndRemove({borrower: {'$eq': borrower}})
        logger.debug('remove borrower: ', borrower)
    }
    
    borrowerExist(borrower: String): boolean {
        return this.borrowers.find({borrower: {'$eq': borrower}}) ? true : false;
    }
    
    enoughTask(): boolean {
        return this.borrowers.data.length ? true : false;
    }
    
    getTaskByBorrower(borrower: String): model.LiquidationParam | null {
        let task = this.borrowers.findOne({borrower: {'$eq': borrower}});
        if(!task) return null;
        this.borrowers.findAndRemove({borrower: {'$eq': borrower}});

        let param: model.LiquidationParam = {
            borrower: task.borrower as unknown as AccountId,
            liquidateToken: task.liquidateToken,
            collateralToken: task.collateralToken,
            repay: task.repay,
        };
        return param
    }
    
    shiftLiquidationParam(): model.LiquidationParam | null {
        let task = this.borrowers.data.shift();
        if (task == undefined) {
            return null
        }

        let param: model.LiquidationParam = {
            borrower: task.borrower as unknown as AccountId,
            liquidateToken: task.liquidateToken,
            collateralToken: task.collateralToken,
            repay: task.repay,
        };
        return param
    }

    resetDB(): void {
        this.db.collections.forEach((collection) => {
            collection.chain().remove();
        });
    }
}

let db = new Database();

export default db;