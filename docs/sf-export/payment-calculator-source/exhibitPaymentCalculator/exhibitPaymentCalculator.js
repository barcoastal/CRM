import { LightningElement, wire, api } from 'lwc';
import { getRecord, getFieldValue, notifyRecordUpdateAvailable } from 'lightning/uiRecordApi';
import TOTAL_DEBT from "@salesforce/schema/Opportunity.Total_Debt__c";
import ESTIMATED_SETTLEMENT from "@salesforce/schema/Opportunity.DS_Estimated_Settlement__c";
import TOTAL_RETAINER_FEE from "@salesforce/schema/Opportunity.DS_Estimated_Retainer_Fee__c";
import ESTIMATED_PROGRAM_FEE from "@salesforce/schema/Opportunity.DS_Estimated_Program_Fee__c";
import TOTAL_AMOUNT from "@salesforce/schema/Opportunity.DS_Total_Amount_With_Fees__c";
import ESTIMATED_AMOUNT_YOU_SAVE from "@salesforce/schema/Opportunity.DS_Estimated_Amount_You_Save__c";
import CURRENT_WEEKLY_PAYMNET from "@salesforce/schema/Opportunity.DS_First_Deposit_Amount__c";
import PROGRAM_TERM from "@salesforce/schema/Opportunity.DS_Payment_Term__c";
import WEEKLY_PAYMENT from "@salesforce/schema/Opportunity.Current_Weekly_Payment__c";
import PAYMENT_FREQUENCY from "@salesforce/schema/Opportunity.DS_Payment_Frequency__c";

import ExhibitHeader from '@salesforce/label/c.Exhibit_Header';
import {  formatCurrency } from "c/utils";
import {
    subscribe,
    unsubscribe,
    APPLICATION_SCOPE,
    MessageContext,
} from 'lightning/messageService';
import refreshSelected from '@salesforce/messageChannel/Refresh__c';

export default class ExhibitPaymentCalculator extends LightningElement {
    @api recordId;
    records = [];
    columns = [];
    headerLabel = ExhibitHeader;
    subscription = null;

    connectedCallback() {
        this.subscribeToMessageChannel();
    }

    @wire(MessageContext)
    messageContext;

    subscribeToMessageChannel() {
        if (!this.subscription) {
            this.subscription = subscribe(
                this.messageContext,
                refreshSelected,
                (message) => this.refreshCmp(message),
                { scope: APPLICATION_SCOPE }
            );
        }
    }
    async refreshCmp(message) {
        await notifyRecordUpdateAvailable([{recordId: this.recordId}]);

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
        fields: [TOTAL_DEBT, ESTIMATED_SETTLEMENT, TOTAL_RETAINER_FEE, TOTAL_AMOUNT, ESTIMATED_AMOUNT_YOU_SAVE, 
            CURRENT_WEEKLY_PAYMNET, ESTIMATED_PROGRAM_FEE, PROGRAM_TERM, WEEKLY_PAYMENT, PAYMENT_FREQUENCY],
    })
    getOppRecord(result) {
        let opp = result.data;

        this.records = [
            
            { paymentLabel: 'PROGRAM LENGTH', weeklyPaymentTotal: getFieldValue(opp, PROGRAM_TERM), order: 0 },
            { paymentLabel: 'TOTAL DEBT', weeklyPaymentTotal: formatCurrency(getFieldValue(opp, TOTAL_DEBT)), order: 0 },
            { paymentLabel: 'RETAINER FEE', weeklyPaymentTotal:  formatCurrency(getFieldValue(opp, TOTAL_RETAINER_FEE)), order: 2 },
            { paymentLabel: 'DISPENSATION FEE', weeklyPaymentTotal:  formatCurrency(getFieldValue(opp, ESTIMATED_PROGRAM_FEE)), order: 3 },
            { paymentLabel: 'TOTAL AMOUNT WITH FEES', weeklyPaymentTotal:  formatCurrency(getFieldValue(opp, TOTAL_AMOUNT)), order: 4 },
            { paymentLabel: 'ESTIMATED AMOUNT YOU SAVE', weeklyPaymentTotal:  formatCurrency(getFieldValue(opp, ESTIMATED_AMOUNT_YOU_SAVE)), order: 5 },
            { paymentLabel: 'FEE PAYMENT SCHEDULE', weeklyPaymentTotal: getFieldValue(opp, PAYMENT_FREQUENCY), order: 0 },
            { paymentLabel: 'TOTAL WEEKLY PAYMENT', weeklyPaymentTotal:  formatCurrency(getFieldValue(opp, CURRENT_WEEKLY_PAYMNET)), order: 6 },
            { paymentLabel: 'WEEKLY SAVING', weeklyPaymentTotal:  formatCurrency((getFieldValue(opp, WEEKLY_PAYMENT)) - (getFieldValue(opp, CURRENT_WEEKLY_PAYMNET) || 0)),  order: 6 }
        ];

        this.columns = [
            {
                label: '',
                type: "string",
                editable: false,
                fieldName: 'paymentLabel',
                style:"font-size: .85rem;",
                wrapText: true,
                width: '60%'

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

    };


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


}