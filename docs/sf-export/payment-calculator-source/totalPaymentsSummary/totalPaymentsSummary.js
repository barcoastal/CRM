import { LightningElement, wire, api ,track} from 'lwc';
import { getRecord, getFieldValue, notifyRecordUpdateAvailable } from 'lightning/uiRecordApi';
import {
    subscribe,
    unsubscribe,
    APPLICATION_SCOPE,
    MessageContext,
} from 'lightning/messageService';
import paymentTotals from '@salesforce/messageChannel/PaymentTotals__c';
import WEEKLY_PAYMENT from "@salesforce/schema/Opportunity.Current_Weekly_Payment__c";
import PROGRAM_TERM from "@salesforce/schema/Opportunity.DS_Payment_Term__c";
import TOTAL_DEBT from "@salesforce/schema/Opportunity.Total_Debt__c";
import ESTIMATED_AMOUNT_YOU_SAVE from "@salesforce/schema/Opportunity.DS_Estimated_Amount_You_Save__c";
import totalPaymentsHeader from '@salesforce/label/c.Total_Payments_Summary';
import {  formatCurrency } from "c/utils";
import {refreshApex} from '@salesforce/apex';


export default class TotalPaymentsSummary extends LightningElement {
    
    @api recordId;
    headerLabel = totalPaymentsHeader;
    @track opp;
    @track records = [];
    message;
    oppResult;

    connectedCallback() {
        this.subscribeToMessageChannel();
    }

    @wire(MessageContext)
    messageContext;

    subscribeToMessageChannel() {
        if (!this.subscription) {
            this.subscription = subscribe(
                this.messageContext,
                paymentTotals,
                (message) => this.handlePaymentTotals(message),
                { scope: APPLICATION_SCOPE }
            );
        }
    }

    disconnectedCallback() {
        this.unsubscribeToMessageChannel();
    }

    unsubscribeToMessageChannel() {
        unsubscribe(this.subscription);
        this.subscription = null;
    }
    @wire(getRecord, {
        recordId: '$recordId',
        fields: [ WEEKLY_PAYMENT,TOTAL_DEBT,PROGRAM_TERM,ESTIMATED_AMOUNT_YOU_SAVE],
    })
    getOppRecord(result) {
        this.oppResult = result;
        this.opp = result.data;
    }

    handlePaymentTotals(message){
       this.records = [
        { paymentLabel: 'PROGRAM LENGTH', weeklyPaymentTotal: getFieldValue(this.opp, PROGRAM_TERM),helpText:'Program Length', order: 0 },
        { paymentLabel: 'TOTAL RETAINER PAYMENT COUNT', weeklyPaymentTotal: message.totalRetainerPaymentCount + '',helpText:'Total Retainer Payment Count', order: 8 },
        { paymentLabel: 'TOTAL DEBT', weeklyPaymentTotal: formatCurrency(getFieldValue(this.opp, TOTAL_DEBT)),helpText:'Total Debt', order: 0 },
        { paymentLabel: 'TOTAL PROGRAM COST', weeklyPaymentTotal: formatCurrency(message.totalAmount),helpText:'Total Program Cost =  Retainer Fee + Program Fee + Setup Fee + Bank Fee + Service Fee + Legal Fee + Settlement Amount', order: 1 },
        { paymentLabel: 'TOTAL RETAINER FEE', weeklyPaymentTotal: formatCurrency(message.totalRetainerFee),helpText:'10% of Total Debt', order: 2  },
        { paymentLabel: 'TOTAL PROGRAM FEE', weeklyPaymentTotal: formatCurrency(message.programFee),helpText:'20% of Total Debt', order: 2  },
        { paymentLabel: 'TOTAL SETUP FEE', weeklyPaymentTotal: formatCurrency(message.setupFee) ,helpText:'One Time Citadel Fee', order: 3  },
        { paymentLabel: 'TOTAL PROCESSOR FEE', weeklyPaymentTotal:  formatCurrency(message.processorFee),helpText:'SAS or RAM Fee', order: 4  },
        { paymentLabel: 'TOTAL SERVICE FEE', weeklyPaymentTotal: formatCurrency(message.serviceFee),helpText:'Weekly Service Fee', order: 5  },
        { paymentLabel: 'TOTAL ESCROW AMOUNT', weeklyPaymentTotal: formatCurrency(message.paymentAmount),helpText:'Total Escrow Amount', order: 6  },
        { paymentLabel: 'ESTIMATED AMOUNT YOU SAVE', weeklyPaymentTotal: formatCurrency(getFieldValue(this.opp, ESTIMATED_AMOUNT_YOU_SAVE)),helpText:'Total Debt - Total Program Cost', order: 6  },
        { paymentLabel: 'TOTAL WEEKLY PAYMENT', weeklyPaymentTotal: formatCurrency(message.WeeklyPayment),helpText:'Total Weekly Payment', order: 6 },
        { paymentLabel: 'TOTAL WEEKLY SAVING', weeklyPaymentTotal:   formatCurrency((getFieldValue(this.opp, WEEKLY_PAYMENT)) - ( message.WeeklyPayment || 0)),helpText:'Total Weekly Savings', order: 7 }
       ];
        refreshApex(this.oppResult);
    }

    get tableProperties() {
        return {
            rowClass: '',
            headerClass: '',
            headerStyle: 'background-color: lightblue !important;',
            scrollable: true,
            scrollableHeight: "500px",
            rowStyle: function (row) {
                if (row.order % 2 == 0) {
                    return "background-color: #f3f3f3;";
                }
                return "background-color: white;" ;
            },
            isHighlightEdited: true,
            isEditAll: true,
            isEditAllOnLoad: true,
            isCalculateTotalRow: true,
            stripRow: true,
            hideHeader:true
        }
    };

    columns = [
        {
            label: '',
            type: "string",
            editable: false,
            fieldName: 'paymentLabel',
            style:"font-size: .85rem;",
            wrapText: true,
            width: '60%',
            helpText:true
        },
        {
            label: '',
            type: "string",
            editable: false,
            fieldName: 'weeklyPaymentTotal',
            style:"font-size: .85rem;",
            width: '40%'
        },
    ]

}