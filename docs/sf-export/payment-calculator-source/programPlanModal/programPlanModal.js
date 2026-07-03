import { LightningElement, api, track, wire } from 'lwc';
import LightningModal from 'lightning/modal';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { getObjectInfo, getPicklistValues } from "lightning/uiObjectInfoApi";
import PROGRAM_PLAN_OBJECT from "@salesforce/schema/Program_Plan__c";
import PAYMENT_TERM_FIELD from "@salesforce/schema/Program_Plan__c.Payment_Term__c";
import { loadStyle } from 'lightning/platformResourceLoader';
//import ProgramPlanCustomStyle from '@salesforce/resourceUrl/ProgramPlanCustomStyle';
import QUALIFIED_FOR_BONUS from '@salesforce/label/c.Qualified_For_Bonus';


export default class ProgramPlanModal extends LightningModal  {

    @api paymentTerms;
    @api paymentTerm;
    @api setupFeeValue;
    @api setupFee;


    @api retainerPercentValue;
    @api settlementPercentValue;
    @api programFeePercentValue;
    @api totalDebt;
    @api monthlyBankFee;
    @api serviceFee;
    @api citadelFee;
    @api bankSetupFee;
    @api paymentFrequency;
    @api currentWeeklyPayment;
    @api firstDepositedPaymentValue;
    @api completedDraftAmount;
    @api completedDraftCount;
    @api completedRetainerDraftAmount;
    @api completedRetainerDraftCount;
    programPlanRecordTypeId;
    qualifiedForBonus = QUALIFIED_FOR_BONUS;


    retainerAmount = 0;
    settlementAmount = 0;
    programFeeAmount = 0;
    estimatedProgramCost = 0;
    monthlyPayments = 0;
    _bankFeePerPayment = 0;
    _serviceFeePerPayment = 0;
    isShowCustomSelection = false;
    showSave = false;
    selectedProgramLength;

    @api paymentTermRecords = [
        { 'paymentTerm': 5, 'selected': false },
        { 'paymentTerm': 6, 'selected': true },
        { 'paymentTerm': 7, 'selected': false },
    ];

    @api bonusProgramLengths;
    _paymentTermRecords = [];


    @track options = [];
    value = ['5','6','7'];
    initiallySelectedValues = [];

    @wire(getObjectInfo, { objectApiName: PROGRAM_PLAN_OBJECT })
  results({ error, data }) {
    if (data) {
      this.programPlanRecordTypeId = data.defaultRecordTypeId;
      this.error = undefined;
    } else if (error) {
      this.error = error;
      this.programPlanRecordTypeId = undefined;
    }
  }

    @wire(getPicklistValues, { recordTypeId: "$programPlanRecordTypeId", fieldApiName: PAYMENT_TERM_FIELD })
    picklistResults({ error, data }) {
        if (data) {
        this.options = data.values;
        this.options = data.values.map(option => {
            const isSelected = this.value.includes(option.value);
            
            return { ...option, selected: isSelected };
        });
        this.error = undefined;
        } else if (error) {
        this.error = error;
        this.options = undefined;
        }
    }

    showToast(title, variant, msg) {
        const event = new ShowToastEvent({
            title: title,
            variant: variant,
            message: msg
        });
        this.dispatchEvent(event);
    }

    handleChange(event) {
        const selectedValue = event.detail.value;
        const isChecked = event.detail.checked;

        if (!this.value) {
            this.value = [];
        }

        if (isChecked) {
            if (!this.value.includes(selectedValue)) {
                this.value.push(selectedValue);
            }
        }
        else {
            this.value = this.value.filter(value => value !== selectedValue);
        }
        this.value.sort((a, b) => Number(a) - Number(b));

        this.handleCustomSave();


    }

    handleBack() {
        this.isShowCustomSelection = false;
    }
    handleValueSelected(event) {
        if(event.detail.programLength) {
            this.selectedProgramLength = event.detail.programLength;
        }
      
    }
    handleSave() {
        let hasNegativePayment = false,selectedProgramCost;

        this.paymentRecords.forEach((row) => {
            if (this.selectedProgramLength == row.paymentTerm && row.monthlyPayments < 0) {
                hasNegativePayment = true;
                selectedProgramCost = row.estimatedProgramCost;
            }
        });

        if (hasNegativePayment) {
            this.showToast('Error','error', 'Total amount $' + selectedProgramCost + ' already exceeds the program cost amount');
            return;
        }


        if(!this.selectedProgramLength) {
            this.selectedProgramLength = this.paymentTerm;
        }
        this.close(this.selectedProgramLength);
    }

    showCustomProgram() {
        this.isShowCustomSelection =  !this.isShowCustomSelection;
    }
    handleCustomSave() {
        let recordsToPaymentRecords = [];

        this.value.forEach((row) => {
            recordsToPaymentRecords.push({'paymentTerm':row,'selected':false});
        });

        this.calculateRetainerAmount();
        this.calculateSettlementAmount();
        this.calculateProgramFeeAmount();
        this.calculateBankFeePerPayment();
        this.calculateServiceFeePerPayment();

        let recordsToProcess = [];


        this.paymentTermRecords = recordsToPaymentRecords;

        this.paymentTermRecords.forEach((row) => {
            const result = this.calculateCosts(row.paymentTerm);

            if (result?.selected === true) {
                recordsToProcess.unshift(result);
            } else {
                recordsToProcess.push(result);
            }
        });


      this.paymentRecords =  recordsToProcess;
      this.showSave = false;
    }

    @track paymentRecords = [];
    calculateCosts(paymentTerm) {
        let estimatedProgramCost =  this.calculateEstimatedProgramCost(paymentTerm);
        let estimatedSavings = this.calculateEstimatedSavings(estimatedProgramCost);
        let monthlyPayments = this.calculateMonthlyPayments(estimatedProgramCost, this.calculateNoOfPayments(paymentTerm));
        let totalAmountWithFees = this.gettotalAmountWithFees();
        let estimatedSavingWithFee = this.getestimatedSaving(estimatedProgramCost);
        let weeklyEstimatedSaving = this.getestimatedWeeklySaving(estimatedProgramCost, paymentTerm);
        let initialSelected = false;

        if (this.initiallySelectedValues.includes(paymentTerm)) {
            initialSelected = true;
        }

        return {'estimatedProgramCost':estimatedProgramCost,'estimatedSavingWithFee':estimatedSavingWithFee,'paymentTerm':paymentTerm,
        'estimatedSavings':estimatedSavings,'monthlyPayments':monthlyPayments,'totalAmountWithFees':totalAmountWithFees,'weeklyEstimatedSaving':weeklyEstimatedSaving,
         'selected' : this.paymentTerm == paymentTerm,'initialSelected':initialSelected};
    }

    connectedCallback() {

        this._paymentTermRecords = [...this.paymentTermRecords];
       
        if (this.paymentTerm) {
            const existingTerm = this._paymentTermRecords.find(
                record => record.paymentTerm == this.paymentTerm
            );
            this.bonusProgramLengths.forEach((record)=> {
                this.initiallySelectedValues.push(record.paymentTerm);
            })
            if (!existingTerm) {
                this._paymentTermRecords.unshift({
                    'paymentTerm': this.paymentTerm,
                    'selected': false
                });

                this._paymentTermRecords.sort((a, b) => {
                    if (a.paymentTerm < b.paymentTerm) return -1;
                    if (a.paymentTerm > b.paymentTerm) return 1;
                    return 0;
                });
            }
            this.selectedProgramLength = this.paymentTerm;
        }


       this.calculateRetainerAmount();
       this.calculateSettlementAmount();
       this.calculateProgramFeeAmount();
       this.calculateBankFeePerPayment();
       this.calculateServiceFeePerPayment();

       let recordsToProcess = [];
       let values = [];

        this._paymentTermRecords.forEach((row) => {
            values.push(row.paymentTerm);

            const result = this.calculateCosts(row.paymentTerm);

            if (result?.selected === true) {
                recordsToProcess.unshift(result);
            } else {
                recordsToProcess.push(result); 
            }
        });
        this.value = values;
        this.paymentRecords =  recordsToProcess;
    }

    renderedCallback() {
        /*Promise.all([
            loadStyle(this, ProgramPlanCustomStyle),
        ]).then(() => { });*/
    }

    formatAmount(amount) {
        if (!amount) {
            return 0.00;
        }  
        return this.roundNumber(amount);
    }
    roundNumber(numberToRound) {
        return Math.floor(numberToRound * 100) / 100;
    }

    getestimatedWeeklySaving(estimatedProgramCost, paymentTermValue) {
        return this.formatAmount(this.currentWeeklyPayment - (((estimatedProgramCost - (this.setupFeeValue +this.retainerAmount)) -
                 (this.completedDraftAmount ? this.completedDraftAmount - (this.completedRetainerDraftAmount || 0):0))
                  /(((paymentTermValue * 4) - 1) - (this.completedDraftCount - this.completedRetainerDraftCount) || 0)));

    }


    calculateEstimatedProgramCost(paymentTermValue) {
        return this.formatAmount(
           ((this.settlementAmount 
            + this.programFeeAmount 
            +this.setupFeeValue
            + this.retainerAmount
             //if completed retaner is greater than current use completed or actual
            + (this._bankFeePerPayment * paymentTermValue)
            + (this._serviceFeePerPayment * (((paymentTermValue * 4) - 1) || 0))
            + this.bankSetupFee)
            +((this.citadelFee || 0)  * paymentTermValue))
        );
    }
    calculateMonthlyPayments(estimatedProgramCost, noOfActualPayments) {
        return this.formatAmount((estimatedProgramCost - this.retainerAmount - this.setupFeeValue - 
         (this.completedDraftAmount ? this.completedDraftAmount - (this.completedRetainerDraftAmount || 0):0)) /Math.abs(noOfActualPayments - (this.completedDraftCount - this.completedRetainerDraftCount) || 0));
    }

    gettotalAmountWithFees() {
        return  this.formatAmount((this.totalDebt * ((parseFloat(this.retainerPercentValue)+ parseFloat(this.settlementPercentValue) + parseFloat(this.programFeePercentValue)))) /100);
    }
    getestimatedSaving(estimatedProgramCost) {
        return  this.formatAmount(this.totalDebt - estimatedProgramCost);
    }

    calculateEstimatedSavings(estimatedProgramCost) {
        return this.formatAmount(this.totalDebt - estimatedProgramCost);
    }

    calculateBankFeePerPayment() {
        this._bankFeePerPayment = this.formatAmount(this.monthlyBankFee);

    }
  

    calculateServiceFeePerPayment() {
        this._serviceFeePerPayment = this.formatAmount(this.serviceFee);
    }



    calculateRetainerAmount() {
        this.retainerAmount = this.calculateAmount(this.retainerPercentValue);
    }

    calculateSettlementAmount() {
        this.settlementAmount = this.calculateAmount(this.settlementPercentValue);
    }

    calculateProgramFeeAmount() {
        this.programFeeAmount = this.calculateAmount(this.programFeePercentValue);
    }

    calculateAmount(percentValue) {
        return this.formatAmount(this.totalDebt * (percentValue/100));
    }


    calculateNoOfPayments(paymentTerm) {
        if (this.paymentFrequency == 'Weekly') {
            return (paymentTerm * 4) - 1;
        } else if (this.paymentFrequency == 'Bi-Monthly') {
            return (paymentTerm * 2) - 1;
        } else if (this.paymentFrequency == 'Monthly') {
            return paymentTerm;
        }

        return 0;
    }


}