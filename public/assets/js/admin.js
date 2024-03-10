const numInputs = document.querySelectorAll('input[type=number]');

numInputs.forEach(numInput => {
    addEventListener('change', () => {
        if ( numInput.value === "") {
            numInput.value = "";
        } else {
            numInput.value = numInput.value * 1.00; // enforce two decimal digits
       }
    });
});

function sendData(formData) {
    fetch('./process/ajax.php', {
        method: 'POST',
        body: formData
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Network not responding. We are probably offline.');
        }
        return response.json();
    })
    .then(data => {
        // Handle the JSON response data
        console.log(data);
        document.getElementById('confirm').showModal();
    })
    .catch(error => {
        // Handle errors
        console.error('There was a problem with the fetch operation:', error);
    });
    removeInputHighlights();
}

const form = document.forms[0];
form.addEventListener('submit', function(event) {
    event.preventDefault();
    
    const formData = new FormData(form);
    formData.append("operation","createRatesFile");
    formData.append("f_type","request");
    sendData(formData);
});

// Load rates from the bamrates.json file into the form
window.addEventListener('load', () => {

    // get the rates for use in the invoice
    fetch('./data/bamrates.json')
      .then((response) => response.json())
      .then((json) => loadRates(json)); 

    // get the list of the most recent invoices
    const formData = new FormData();
    formData.append("operation","listInvoices");
    formData.append("f_type","request");

    fetch('./process/ajax.php', {
        method: 'POST',
        body: formData
    })
    .then((response) => response.json())
    .then((data) => {
        loadFileNames(data);
    })
    .catch(error => console.error('Error fetching files:', error));
});

function loadRates(file) {
    varRates = file[0];
    flatRates = file[1];

    document.getElementById('usa-wkdy-hrs').value = varRates.usa.wkdy.hrs;
    document.getElementById('usa-wkdy-aog').value = varRates.usa.wkdy.aog;
    document.getElementById('usa-wkdy-o2').value = varRates.usa.wkdy.o2;
    document.getElementById('usa-wkdy-oil').value = varRates.usa.wkdy.oil;
   
    document.getElementById('usa-over-hrs').value = varRates.usa.over.hrs;
    document.getElementById('usa-over-aog').value = varRates.usa.over.aog;
    document.getElementById('usa-over-o2').value = varRates.usa.over.o2;
    document.getElementById('usa-over-oil').value = varRates.usa.over.oil;
   
    document.getElementById('usa-holi-hrs').value = varRates.usa.holi.hrs;
    document.getElementById('usa-holi-aog').value = varRates.usa.holi.aog;
    document.getElementById('usa-holi-o2').value = varRates.usa.holi.o2;
    document.getElementById('usa-holi-oil').value = varRates.usa.holi.oil;

    document.getElementById('foreign-wkdy-hrs').value = varRates.foreign.wkdy.hrs;
    document.getElementById('foreign-wkdy-aog').value = varRates.foreign.wkdy.aog;
    document.getElementById('foreign-wkdy-o2').value = varRates.foreign.wkdy.o2;
    document.getElementById('foreign-wkdy-oil').value = varRates.foreign.wkdy.oil;
   
    document.getElementById('foreign-over-hrs').value = varRates.foreign.over.hrs;
    document.getElementById('foreign-over-aog').value = varRates.foreign.over.aog;
    document.getElementById('foreign-over-o2').value = varRates.foreign.over.o2;
    document.getElementById('foreign-over-oil').value = varRates.foreign.over.oil;
   
    document.getElementById('foreign-holi-hrs').value = varRates.foreign.holi.hrs;
    document.getElementById('foreign-holi-aog').value = varRates.foreign.holi.aog;
    document.getElementById('foreign-holi-o2').value = varRates.foreign.holi.o2;
    document.getElementById('foreign-holi-oil').value = varRates.foreign.holi.oil;

    document.getElementById('tire').value = flatRates.tire;
    document.getElementById('n2').value = flatRates.n2;
    document.getElementById('lav').value = flatRates.lav;
    document.getElementById('logbook').value = flatRates.rts[2];
    document.getElementById('access').value = flatRates.access;
    document.getElementById('tks').value = flatRates.tks;
    document.getElementById('woship').value = flatRates.woship;
    document.getElementById('signoff').value = flatRates.rts[1];
    document.getElementById('jeta').value = flatRates.fuel[0];
    document.getElementById('jetaplus').value = flatRates.fuel[1];
    document.getElementById('qt').value = flatRates.qt;
}

function loadFileNames(json) {
    var invoiceListing =document.getElementById('invoicefiles');
    for (const [key, value] of Object.entries(json)) {
        var lineItem = document.createElement('p');
        var itemLink = document.createElement('a');
        var fileNameParts = value.split("/");
        var fileName = fileNameParts.pop();
        itemLink.setAttribute("href", "submissions/" + value);
        itemLink.setAttribute("target","_blank");
        itemLink.textContent = fileName.slice(0, -5);
        lineItem.appendChild(itemLink) ;
        invoiceListing.appendChild(lineItem);
    }
}
 
const confirmBox = document.getElementById('confirm');
const closeConfirm = document.getElementById('close-confirm');

const inputFields = document.querySelectorAll('input[type=number]');
inputFields.forEach( field => {
    field.addEventListener('change', () => {
        field.style.backgroundColor = "yellow";
    })
});

function removeInputHighlights() {
    inputFields.forEach( field => {
        field.style.backgroundColor = "white";
    });
}

