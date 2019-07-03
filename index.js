
const uscis = require('uscis');
const _ = require('underscore');
 

// config params
const MAX_CONCURRENT_REQUEST = 6;
const RANGE_TO_SEARCH = 2000;
const MY_RECEIPT_NUM = 1990205965;
const RECEIPT_PREFIX = 'YSC';
const FILTER_765 = true;
const FILTER_NO_CASE_RECEIVED = true;
const PRINT_FILTER_MSG = false;

// globals
let requestQueue = [];
let result = {};
let range = RANGE_TO_SEARCH;


(function run() {
    // bookkeep the boundary index of this run in the function closure
    const startingNum = MY_RECEIPT_NUM-range;
    let endingNum = startingNum-1;

    _.each(_.range(MAX_CONCURRENT_REQUEST), () => {
        if (range < 0) {
            return;
        }

        const fullReceipt = `${RECEIPT_PREFIX}${MY_RECEIPT_NUM-range}`;
        const req = uscis(fullReceipt);
        range--;
        endingNum++;
    
        requestQueue.push(req);
        req.then((status) => {
            updateResult(fullReceipt, status);
        });
    });
    
    Promise.all(requestQueue).then(() => {
        // print and clear them in memory
        printStatus(startingNum, endingNum);
        result = {};

        if (range >= 0) {
            // start another series of requests
            requestQueue = [];
            run();
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
function updateResult(fullReceipt, status) {
    const title = status.title;
    const details = status.details;

    function clearAndAppend(msg) {
        if (!status.hasOwnProperty('filter')) {
            status = { 'filter': [] };
        }
        status['filter'].push(msg);
    }

    if (FILTER_765 && details.indexOf('Form I-765') < 0) {
        clearAndAppend('Form I-765 Only');
    }
    if (FILTER_NO_CASE_RECEIVED && title == 'Case Was Received') {
        clearAndAppend('Case Received Ignore')
    }

    result[fullReceipt] = status;
}


