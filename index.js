
const uscis = require('./uscis/lib/case-status');
const _ = require('underscore');
 

// config params
const MAX_CONCURRENT_REQUEST = 6;
const RANGE_TO_SEARCH = 10;
const MY_RECEIPT_NUM = 1990205965;
const RECEIPT_PREFIX = 'YSC';
const FILTER_765 = true;
const FILTER_NO_CASE_RECEIVED = true;
const PRINT_FILTER_MSG = false;

// globals
let requestQueue = [];
let result = {};
let range = RANGE_TO_SEARCH;
const failedQueries = [];


(function run() {
    // bookkeep the boundary index of this run in the function closure
    const startingNum = MY_RECEIPT_NUM-range;
    let endingNum = startingNum-1;

    _.each(_.range(MAX_CONCURRENT_REQUEST), () => {
        if (range < 0) {
            return;
        }

        const fullReceipt = `${RECEIPT_PREFIX}${MY_RECEIPT_NUM-range}`;
        const request = safeProbe(fullReceipt, (status) => {
            updateResult(fullReceipt, status);
        }, (error) => {
            updateResult(fullReceipt, null);
            failedQueries.push(fullReceipt);
        });
        range--;
        endingNum++;

        requestQueue.push(request);
    });
    
    Promise.all(requestQueue).then(() => {
        // print and clear them in memory
        printStatus(startingNum, endingNum);
        result = {};

        if (range >= 0) {
            // start another series of requests
            requestQueue = [];
            run();
        } else {
            // finish with a summary
            const start = MY_RECEIPT_NUM - RANGE_TO_SEARCH;
            const end = MY_RECEIPT_NUM;
            console.log('\n\n############################################');
            console.log(`Processed status ${RECEIPT_PREFIX}${start} to ${RECEIPT_PREFIX}${end}.`);
            console.log(`${failedQueries.length} queries have failed:`);
            console.log(failedQueries);
            console.log('############################################');
        }
    });
})();

// print from big receipt num to small, starting from my receipt number
function printStatus(start, end) {
    _.each(_.range(start, end+1), (receiptNumber) => {
        const fullReceipt = `${RECEIPT_PREFIX}${receiptNumber}`;
        const status = result[fullReceipt];

        // ========================================
        // temporary: ignore all non I 765
        if (status.hasOwnProperty('filter') && status.filter[0] == 'Form I-765 Only')
            return;
        // ========================================

        console.log(fullReceipt);
        if (!status.hasOwnProperty('filter')) {
            console.log(status.title);
            console.log(status.details);
        } else if (PRINT_FILTER_MSG) {
            console.log(status.filter);
        }
        console.log('=================================================================')
    })
}

// process status and apply filter
// status can be null, in which case it will add an 'unavailable' msg
function updateResult(fullReceipt, status) {
    function clearAndAppend(msg) {
        if (!status.hasOwnProperty('filter')) {
            status = { 'filter': [] };
        }
        status['filter'].push(msg);
    }
    
    if (status) {
        const title = status.title;
        const details = status.details;
        
        if (FILTER_765 && details.indexOf('Form I-765') < 0) {
            clearAndAppend('Form I-765 Only');
        }
        if (FILTER_NO_CASE_RECEIVED && title == 'Case Was Received') {
            clearAndAppend('Case Received Ignore')
        }
    } else {
        status = {};
        clearAndAppend('Status Unavailable');
    }

    result[fullReceipt] = status;
}

// wrapper of the scraper function, with error handling
// returns a promise, which, always resolves, even when there is an error
// onResolve: function(statusObject)
// onReject: function(error)
function safeProbe(fullReceipt, onResolve, onReject) {
    return new Promise((resolve, reject) => {
        const req = uscis(fullReceipt);
        req.then((status) => {
            onResolve(status);
            resolve();
        }, (error) => {
            onReject(error);
            resolve();
        });
    });
}

