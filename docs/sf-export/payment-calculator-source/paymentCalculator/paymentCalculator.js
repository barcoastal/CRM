import { LightningElement, track, api, wire } from 'lwc';
import { loadScript } from "lightning/platformResourceLoader";
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { getPicklistValues } from 'lightning/uiObjectInfoApi';
import momentJS from "@salesforce/resourceUrl/MomentJS";
import getRecordTypeDeveloperName from '@salesforce/apex/LeadPaymentCalcController.getRecordTypeDeveloperName';
import getRecordTypeBasedOnRTName from '@salesforce/apex/LeadPaymentCalcController.getRecordTypeBasedOnRTName';
import saveLeadDetails from '@salesforce/apex/LeadPaymentCalcController.saveLeadDetails';
import getCurrentRecordDetails from '@salesforce/apex/LeadPaymentCalcController.getCurrentRecordDetails';
import getPaymentCalcSettings from '@salesforce/apex/LeadPaymentCalcController.getPaymentCalcSettings';
import checkIsAgentProfile from '@salesforce/apex/LeadPaymentCalcController.checkIsAgentProfile';
import PAYMENT_TERM_FIELD from '@salesforce/schema/Lead.Payment_Term__c';
import FREQUENCY_FIELD from '@salesforce/schema/Lead.Frequency__c';
import RETAINER_PERCENT_FIELD from '@salesforce/schema/Lead.Retainer_Percentage__c';
import SETTLEMENT_PERCENT_FIELD from '@salesforce/schema/Lead.Settlement_Percentage__c';
import PROGRAM_FEE_PERCENT_FIELD from '@salesforce/schema/Lead.Program_Fee_Percentage__c';
import SETUP_FEE_FIELD from '@salesforce/schema/Lead.Setup_Fee__c';

export default class PaymentCalculator extends LightningElement {
    @api recordId;

    @track leadWrapObj = {};
    @track cloneLeadWrapObj = {};
    @track paymentData = [];
    @track paymentTableColumnLabel = {
        'Payment Amount' : 'Payment Amount',
        'Program Fee' : 'Program Fee',
        'Service Fee' : 'Service Fee',
        'Bank Fee' : 'Monthly Bank Fee',
        'Savings' : 'Monthly Savings'
    };

    leadTypeValue;
    disableLeadType = true;
    renderRetainer = true;
    showSaveButton = false;
    retainerAmount = 0.00;
    settlementAmount = 0.00;
    programFeeAmount = 0.00;
    serviceFee = 0.00;
    estimatedProgramCost = 0.00;
    estimatedSavings = 0.00;
    monthlyPayments = 0.00;
    paymentAmountLabel = 'Payments'
    showSpinner = true;
    
    _serviceFeePerPayment = 0.00;
    _programFeeRemaining = 0.00;
    _bankFeePerPayment = 0.00;
    _businessLead = 'Business';
    _consumerLead = 'Consumer';
    _isrendered = false;
    _noOfPayments;
    _noOfActualPayments;
    _recordTypeId;
    _paymentCalcSettingsWrap = {};
    _isAgentProfile = false;

    connectedCallback() {
        this.onLoadActions();
    }

    renderedCallback() {
        if (this._isrendered == false) {
            this.afterRenderActions();
            this._isrendered = true;
        }
    }

    refreshCalculator() {
        //this.onLoadActions();
        //this.afterRenderActions();
        this.paymentData = [];
        this.leadWrapObj['totalDebt'] = 0;
        this.leadWrapObj['paymentTermValue'] = this.cloneLeadWrapObj['paymentTermValue'];
         this.onLoadActions();
         this.afterRenderActions();
           this.recalculateCalculatorSection();

    }

    onLoadActions() {
        this.showSpinner = true;
        if (this.recordId) {
            this.leadWrapObj['recordId'] = this.recordId;
            this.disableLeadType = true;
            this.showSaveButton = true;
            this.getRecordTypeName();
        } else {
            this.leadTypeValue = this._businessLead;
            this.setBusinessLeadConfig();
            this.disableLeadType = false;
            this.getRecordTypeNameBasedOnName();
        }
        this.getPaymentCalculatorSettings();
        this.isAgentProfile();
    }

    afterRenderActions() {
        Promise.all([
            loadScript(this, momentJS + '/moment/scripts/moment.min.js')
        ]).catch(error => {
            this.showToast('Moment Loading Failed', 'error', error);
        });
        if (this.recordId) {
            this.getRecordDetails();
        }
        this.calculateNoOfPayments();
        this.calculateCosts();
        this._isrendered = true;
        setTimeout(() => {
            this.showSpinner = false;
        }, 1000);
    }

    getRecordTypeName() {
        getRecordTypeDeveloperName({leadId : this.recordId})
        .then(result => {
            if (result.resultStatus == 'SUCCESS') {
                var recordTypeDevName = result.data.RecordType.DeveloperName;
                this._recordTypeId = result.data.RecordType.Id;
                if (recordTypeDevName == this._businessLead) {
                    this.leadTypeValue = this._businessLead;
                    this.setBusinessLeadConfig();
                } else if (recordTypeDevName == this._consumerLead) {
                    this.leadTypeValue = this._consumerLead;
                    this.setConsumerLeadConfig();
                }
            } else {
                this.showToast('Get Record Type Name Failed', 'error', result.message);
            }
        }).catch(error => {
            this.showToast('Get Record Type Name Failed', 'error', error);
        });
    }

    getRecordTypeNameBasedOnName() {
        getRecordTypeBasedOnRTName({recordTypeName : this.leadTypeValue})
        .then(result => {
            if (result.resultStatus == 'SUCCESS') {
                this._recordTypeId = result.data.Id;
            } else {
                this.showToast('Get Record Type Based On Name Failed', 'error', result.message);
            }
        }).catch(error => {
            this.showToast('Get Record Type Based On Name Failed', 'error', error);
        });
    }

    getRecordDetails() {
        getCurrentRecordDetails({leadId : this.recordId})
        .then(result => {
            if (result.resultStatus == 'SUCCESS') {
                if (result.data) {
                    this.cloneLeadWrapObj = JSON.parse(result.data);
                    this.leadWrapObj = JSON.parse(result.data);
                    this.recalculateCalculatorSection();
                }
            } else {
                this.showToast('Get Current Record Details Failed', 'error', error);
            }
        }).catch(error => {
            this.showToast('Get Current Record Details Failed', 'error', error);
        });
    }

    getPaymentCalculatorSettings() {
        getPaymentCalcSettings()
        .then(result => {
            if (result.resultStatus == 'SUCCESS') {
                this._paymentCalcSettingsWrap = JSON.parse(result.data);
                this.serviceFee = this._paymentCalcSettingsWrap.serviceFee;
            } else {
                this.showToast('Get Payment Calculator Failed', 'error', error);
            }
        }).catch(error => {
            this.showToast('Get Payment Calculator Failed', 'error', error);
        });
    }

    isAgentProfile() {
        checkIsAgentProfile()
        .then(result => {
            if (result.resultStatus == 'SUCCESS') {
                if (result.data == 'isAgent') {
                this._isAgentProfile = true;
                }
            } else {
                this.showToast('Checking the profile is agent or not Failed', 'error', error);
            }
        }).catch(error => {
            this.showToast('Checking the profile is agent or not Failed', 'error', error);
        });
    }

    setLeadType(event) {
        this.leadTypeValue = event.target.value;
        if (this.leadTypeValue == this._businessLead) {
            this.setBusinessLeadConfig();
        } else if (this.leadTypeValue == this._consumerLead) {
            this.setConsumerLeadConfig();
        }
        this.getRecordTypeNameBasedOnName();
        this.calculateNoOfPayments();
        this.calculateCosts();
    }

    setBusinessLeadConfig() {
        this.renderRetainer = true;
    }

    setConsumerLeadConfig() {
        this.renderRetainer = false;
    }

    get totalDebt() {
        return this.formatAmount(parseFloat(this.leadWrapObj['totalDebt']));
    }

    setTotalDebt(event) {
        this.constructLeadWrapObj(event);
        this.recalculateCalculatorSection();
    }

    resetTotalDebt(event) {
        this.constructLeadWrapObj(event);
    }

    get paymentTermValue() {
        return this.leadWrapObj['paymentTermValue'];
    }

    setPaymentTerm(event) {
        this.constructLeadWrapObj(event);
        this.calculateNoOfPayments();
        this.calculateCosts();
    }

    get paymentFrequencyValue() {
        return this.leadWrapObj['paymentFrequencyValue'];
    }

    setPaymentFrequency(event) {
        this.constructLeadWrapObj(event);
        this.calculateNoOfPayments();
        this.calculateBankFeePerPayment();
        this.calculateServiceFeePerPayment();
        this.calculateCosts();
    }

    get downPayment() {
        return this.formatAmount(parseFloat(this.leadWrapObj['downPayment']));
    }

    setDownPayment(event) {
        this.constructLeadWrapObj(event);
        this.calculateCosts();
    }

    resetDownPayment(event) {
        this.constructLeadWrapObj(event);
    }

    get retainerPercentValue() {
        return this.leadWrapObj['retainerPercentValue'];
    }

    setRetainerPercent(event) {
        this.constructLeadWrapObj(event);
        this.calculateRetainerAmount();
    }

    get settlementPercentValue() {
        return this.leadWrapObj['settlementPercentValue'];
    }

    setSettlementPercent(event) {
        this.constructLeadWrapObj(event);
        this.calculateSettlementAmount();
    }

    get programFeePercentValue() {
        return this.leadWrapObj['programFeePercentValue'];
    }

    setProgramFeePercent(event) {
        this.constructLeadWrapObj(event);
        this.calculateProgramFeeAmount();
    }

    get monthlyBankFee() {
        return this.formatAmount(parseFloat(this.leadWrapObj['monthlyBankFee'])) || 10;
    }

    get bankSetupFee() {
        return this.formatAmount(parseFloat(this.leadWrapObj['bankSetupFee'])) || 15;
    }
    setMonthlyBankFee(event) {
        this.constructLeadWrapObj(event);
        this.calculateBankFeePerPayment();
        this.calculateCosts();
    }

    resetMonthlyBankFee(event) {
        this.constructLeadWrapObj(event);
    }

    get setupFeeValue() {
        return this.leadWrapObj['setupFeeValue'];
    }

    setSetupFee(event) {
        this.constructLeadWrapObj(event);
        this.calculateCosts();
    }

    constructLeadWrapObj(event) {
        this.leadWrapObj[event.target.name] = event.target.value;
    }

    recalculateCalculatorSection() {
        this.calculateNoOfPayments();
        this.calculateBankFeePerPayment();
        this.calculateServiceFeePerPayment();
        this.calculateRetainerAmount();
        this.calculateSettlementAmount();
        this.calculateProgramFeeAmount();
        this.calculateCosts();
    }

    calculateRetainerAmount() {
        this.retainerAmount = this.calculateAmount(this.retainerPercentValue);
        this.calculateCosts();
    }

    calculateSettlementAmount() {
        this.settlementAmount = this.calculateAmount(this.settlementPercentValue);
        this.calculateCosts();
    }

    calculateProgramFeeAmount() {
        this.programFeeAmount = this.calculateAmount(this.programFeePercentValue);
        this.calculateCosts();
    }

    calculateCosts() {
        this.calculateEstimatedProgramCost();
        this.calculateEstimatedSavings();
        this.calculateMonthlyPayments();
    }

    calculateEstimatedProgramCost() {
        this.estimatedProgramCost = this.formatAmount(
            this.settlementAmount 
            + this.programFeeAmount 
            + (this._bankFeePerPayment * this.paymentTermValue)
            + (this._serviceFeePerPayment * (this.paymentTermValue * 4))
            + this.bankSetupFee
            - this.downPayment 
        );
    }

    get totalAmountWithFees() {
        return  this.formatAmount(this.totalDebt * ((parseFloat(this.retainerPercentValue)+ parseFloat(this.settlementPercentValue) + parseFloat(this.programFeePercentValue))/100));
    }
    get estimatedSaving() {
        return  this.formatAmount(this.totalDebt - this.totalAmountWithFees);
    }

    calculateEstimatedSavings() {
        this.estimatedSavings = this.formatAmount(this.totalDebt - this.estimatedProgramCost);
    }

    calculateMonthlyPayments() {
        this.monthlyPayments = this.formatAmount(this.estimatedProgramCost/this._noOfActualPayments);
    }

    calculateBankFeePerPayment() {
        this._bankFeePerPayment = this.formatAmount(this.monthlyBankFee);

    }

    calculateServiceFeePerPayment() {
        this._serviceFeePerPayment = this.formatAmount(this.serviceFee);
    }

    calculateAmount(percentValue) {
        return this.formatAmount(this.totalDebt * (percentValue/100));
    }

    calculateNoOfPayments() {
        if (this.paymentFrequencyValue == 'Weekly') {
            this._noOfPayments = (this.paymentTermValue * 4);
        } else if (this.paymentFrequencyValue == 'Bi-Monthly') {
            this._noOfPayments = this.paymentTermValue * 2;
        } else if (this.paymentFrequencyValue == 'Monthly') {
            this._noOfPayments = this.paymentTermValue;
        }
        if (this.leadTypeValue == this._businessLead) {
            this._noOfActualPayments = this._noOfPayments - 1;
        } else {
            this._noOfActualPayments = this._noOfPayments;
        }
        this.constructPaymentAmountLabel();
    }

    constructPaymentAmountLabel() {
        this.paymentAmountLabel = this.paymentFrequencyValue + ' Payments';
        this.paymentTableColumnLabel['Payment Amount'] = this.paymentFrequencyValue + ' Payment Amount';
        this.paymentTableColumnLabel['Program Fee'] = this.paymentFrequencyValue + ' Program Fee';
        this.paymentTableColumnLabel['Service Fee'] = this.paymentFrequencyValue + ' Service Fee';
        this.paymentTableColumnLabel['Bank Fee'] = this.paymentFrequencyValue + ' Bank Fee';
        this.paymentTableColumnLabel['Savings'] = this.paymentFrequencyValue + ' Savings';
    }   

    getRetainerAmount() {
        if (this.leadTypeValue == this._businessLead) {
            return this.retainerAmount;
        } else if (this.leadTypeValue == this._consumerLead) {
            return 0;
        }  
        return 0; 
    }

    saveLeadDetails() {
        this.showSpinner = true;
        saveLeadDetails({leadDetails : JSON.stringify(this.leadWrapObj)})
        .then(result => {
            if (result.resultStatus == 'SUCCESS') {
                this.showToast('Success', 'success', 'The Payment Calculation details are saved in the lead record.');
                this.showSpinner = false;
            } else {
                this.showToast('Save Calculation Details Failed', 'error', error);
                this.showSpinner = false;
            }
        })
        .catch(error => {
            this.showToast('Save Calculation Details Failed', 'error', error);
            this.showSpinner = false;
        });
    }

    calculatePayments() {
         if(!this.totalDebt) {
            this.showToast('Total Debt is zero Calculation is Failed', 'error', 'error');
            return; 
         }
         
    
        this.showSpinner = true;
        this.paymentData = [];
        this.reset_programFeeRemaining();
        var savingsPerPayment = this.calculateSavingsPerPayment();
        let paymentCounter = 0;  

    for (let i = 1; i <= this._noOfPayments; i++) {
        if (paymentCounter === 4) {
            paymentCounter = 0;
        }

        if (i == 1 && this.leadTypeValue == this._businessLead) {
            this.paymentData.push(
                {
                    payment: (parseFloat(this.retainerAmount) + parseFloat(this.setupFeeValue)), 
                    setupFee: parseFloat(this.setupFeeValue),
                    programFee: 0.00,
                    serviceFee: 0.00,
                    bankFee: 0.00,  // No bank fee for the first business lead payment
                    savings: 0.00
                }
            );
        } else {
            var prgmFee = this.getProgramFeeForMonth(savingsPerPayment);
            paymentCounter++;

            let bankFeeToApply = (paymentCounter === 1) ? this._bankFeePerPayment : 0.00;
            if(i == 2 && this.bankSetupFee) { // hardcoded 2 because it always be on the first payment
                bankFeeToApply = bankFeeToApply + this.bankSetupFee;
            }
            this.paymentData.push(
                {
                    payment: this.monthlyPayments, 
                    setupFee: 0.00,
                    programFee: prgmFee,
                    serviceFee: this._serviceFeePerPayment,
                    bankFee: bankFeeToApply, 
                    savings: (savingsPerPayment - prgmFee)
                }
            );
        }
    }


        this.paymentData = [...this.paymentData];
        this.showSpinner = false;
    }

    reset_programFeeRemaining() {
        this._programFeeRemaining = this.programFeeAmount;
    }

    calculateSavingsPerPayment() {
        return this.formatAmount(
            ((this.monthlyPayments * this._noOfActualPayments) 
            - (this._serviceFeePerPayment * this._noOfActualPayments) 
            - (this._bankFeePerPayment * this._noOfActualPayments)
            )/this._noOfActualPayments
        );
    }

    getProgramFeeForMonth(savingsPerPayment) {
        var prgmFee = 0.00;
        var minPrgmFeePercent = this.getProgramFeeMinPercent();
        if ((savingsPerPayment - (savingsPerPayment * (minPrgmFeePercent/100))) < this._programFeeRemaining) {
            prgmFee = (savingsPerPayment - (savingsPerPayment * (minPrgmFeePercent/100)));
        } else {
            prgmFee = this._programFeeRemaining;
        }
        prgmFee = this.formatAmount(prgmFee);
        this._programFeeRemaining -= prgmFee;
        return prgmFee; 
    }

    getProgramFeeMinPercent() {
        var minPrgmFeePercent;
        if (this.paymentFrequencyValue == 'Weekly') {
            minPrgmFeePercent = this._paymentCalcSettingsWrap.minSavingsCollectionPercentWeekly;
        } else if (this.paymentFrequencyValue == 'Bi-Monthly') {
            minPrgmFeePercent =  this._paymentCalcSettingsWrap.minSavingsCollectionPercentBiMonthly;
        } else if (this.paymentFrequencyValue == 'Monthly') {
            minPrgmFeePercent = this._paymentCalcSettingsWrap.minSavingsCollectionPercentMonthly;
        }
        return minPrgmFeePercent;
    }

    formatAmount(amount) {
        if (!amount) {
            return 0.00;
        } 
        return this.roundNumber(amount);
    }

    roundNumber(numberToRound) {
        return Math.round(numberToRound * 100) / 100;
    }

    showToast(title, variant, msg) {
        const event = new ShowToastEvent({
            title: title,
            variant: variant,
            message: msg
        });
        this.dispatchEvent(event);
    }

    get leadTypes() {
        return [
            { label: 'Business Lead', value: this._businessLead },
            //{ label: 'Consumer Lead', value: this._consumerLead },
        ];
    }

    get columns() { 
        return [
            { 
                label: this.paymentTableColumnLabel['Payment Amount'],
                fieldName: 'payment', 
                type: 'currency'
            },
            { 
                label: 'Setup Fee', 
                fieldName: 'setupFee', 
                type: 'currency' 
            },
            { 
                label: this.paymentTableColumnLabel['Program Fee'],
                fieldName: 'programFee', 
                type: 'currency' 
            },
            { 
                label: this.paymentTableColumnLabel['Service Fee'],
                fieldName: 'serviceFee', 
                type: 'currency' 
            },
            { 
                label: "Monthly Bank Fee",
                fieldName: 'bankFee', 
                type: 'currency' 
            },            
            { 
                label: this.paymentTableColumnLabel['Savings'],
                fieldName: 'savings', 
                type: 'currency' 
            }
        ];
    }

    getColumnLabelPrefix() {
        let columnLabelPrefix;
        if (this.paymentFrequencyValue == 'Monthly') {
            columnLabelPrefix = 'Monthly';
        }
        return columnLabelPrefix;
    }

    @wire(getPicklistValues, {
        fieldApiName: PAYMENT_TERM_FIELD,
        recordTypeId: '$_recordTypeId'
    })
    getPaymentTermValues({ data, error }) {
        if (error) {
            this.showToast('Failure', 'error', error);
        } else if (data) {
            this.paymentTerms = [...data.values];
            this.leadWrapObj['paymentTermValue'] = data?.defaultValue?.value;
        }
    }

    @wire(getPicklistValues, {
        fieldApiName: FREQUENCY_FIELD,
        recordTypeId: '$_recordTypeId'
    })
    getFrequencyValues({ data, error }) {
        if (error) {
            this.showToast('Failure', 'error', error);
        } else if (data) {
            this.paymentFrequencies = [...data.values];
            this.leadWrapObj['paymentFrequencyValue'] = data?.defaultValue?.value;
            this.constructPaymentAmountLabel();
        }
    }

    @wire(getPicklistValues, {
        fieldApiName: RETAINER_PERCENT_FIELD,
        recordTypeId: '$_recordTypeId'
    })
    getRetainerPercentValues({ data, error }) {
        if (error) {
            this.showToast('Failure', 'error', error);
        } else if (data) {
            this.retainerPercentages = [...data.values];
            this.leadWrapObj['retainerPercentValue'] = data?.defaultValue?.value;
        }
    }

    @wire(getPicklistValues, {
        fieldApiName: SETTLEMENT_PERCENT_FIELD,
        recordTypeId: '$_recordTypeId'
    })
    getSettlementPercentValues({ data, error }) {
        if (error) {
            this.showToast('Failure', 'error', error);
        } else if (data) {
            this.settlementPercentages = [...data.values];
            if (this._isAgentProfile == true) {
                this.settlementPercentages = [
                    {label: "40", value:"40" },
                    {label: "41", value:"41" },
                    {label: "42", value:"42" },
                    {label: "43", value:"43" }
                ];
                this.settlementPercentages = [...this.settlementPercentages];
            }
            this.leadWrapObj['settlementPercentValue'] = data?.defaultValue?.value;
        }
    }

    @wire(getPicklistValues, {
        fieldApiName: PROGRAM_FEE_PERCENT_FIELD,
        recordTypeId: '$_recordTypeId'
    })
    getProgramFeePercentValues({ data, error }) {
        if (error) {
            this.showToast('Failure', 'error', error);
        } else if (data) {
            this.programFeePercentages = [...data.values];
            this.leadWrapObj['programFeePercentValue'] = data?.defaultValue?.value;
        }
    }

    @wire(getPicklistValues, {
        fieldApiName: SETUP_FEE_FIELD,
        recordTypeId: '$_recordTypeId'
    })
    getSetupFeeValues({ data, error }) {
        if (error) {
            this.showToast('Failure', 'error', error);
        } else if (data) {
            this.setupFeeValues = [...data.values];
            this.leadWrapObj['setupFeeValue'] = data?.defaultValue?.value;
        }
    }
}