import { LightningElement, api, track, wire } from 'lwc';
import { getRecord } from "lightning/uiRecordApi";
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { NavigationMixin } from 'lightning/navigation';

import { CloseActionScreenEvent } from 'lightning/actions';
import DEBT_RECORD_NOT_FOUND from "@salesforce/label/c.Debt_Record_Not_Found";
import DEBT_SCHEDULE_RECORD_NOT_FOUND from "@salesforce/label/c.Debt_Schedule_Record_Not_Found";
import DRAFT_RECORD_NOT_FOUND from "@salesforce/label/c.Draft_Record_Not_Found";
import OPPORTUNITY_CLOSED_NOT_FOUND from "@salesforce/label/c.Opportunity_Closed_Contract_Message";
import { refreshApex } from '@salesforce/apex';

import {
    ALL_OPP_FIELDS,
    OPP_FIELDS,
    FIELDS,
    getEmptyFields,
    getIsEmptyCheck,
    getEmptyFieldsFromArray,
    DRAFT_FIELDS,
    DEBT_SCHEDULE_FIELDS,
    getEmptyDebtFieldsFromArray,
    ACCOUNT_FIELDS,
    extractRelatedFields,
    OPPORTUNITY_FIELDS,
    convertFieldsIntoObjects

} from "./validation";

import getSendContractDetails from '@salesforce/apex/SendContractController.getSendContractDetails';
import saveContractDetails from '@salesforce/apex/SendContractController.saveContractDetails';
import reEvaluateLegalNetwork from '@salesforce/apex/LegalNetworkReEvaluationController.reEvaluateLegalNetwork';
const CLOSED_STAGES = ['Closed Won First Payment Pending', 'Closed Won - First Payment Completed', 'Closed Lost'];
import ACCOUNT_OBJECT from '@salesforce/schema/Account';
import CONTACT_OBJECT from '@salesforce/schema/Contact';
import OPPORTUNITY_OBJECT from '@salesforce/schema/Opportunity';
import checkCompletedPaymentValidation from '@salesforce/apex/ProgramPlanController.checkCompletedPaymentValidation';
import validateRoutingNumber from '@salesforce/apex/RoutingNumberService.validateRoutingNumber';
import BypassRoutingNumberValidation from '@salesforce/customPermission/Bypass_Routing_Number_Validation';
import OverrideLegalNetwork from '@salesforce/customPermission/Override_Legal_Network';
import OverrideLegalNetworkAdvanced from '@salesforce/customPermission/Override_Legal_Network_Advanced';
import OverrideAddendum from '@salesforce/customPermission/Override_Addendum';

export default class CoastalContractReview extends NavigationMixin(LightningElement) {
    _recordId;
    @api get recordId() { return this._recordId; }
    set recordId(value) { if (value && value !== this._recordId) { this._recordId=value; this.getContractDetails(value, null); } }
    completed = false;
    baseUri;
    recordWrapper;
    isShowError = false;
    recordFormTosave = {
        'Account': { 'sObjectType': 'Account' },
        'Contact': { 'sObjectType': 'Contact' },
        'Opportunity': { 'sObjectType': '' }
    };
    isSaved = false;
    oppData;
    showSpinner = false;
    showReEvaluationModal = false;

    @track recordForms;
    @track errorMessages;

    get isAddendumEditable() {
        return OverrideAddendum;
    }

    get isLegalNetworkEditable() {
        // Admin-level: edit regardless of any field value
        if (OverrideLegalNetworkAdvanced) return true;
        // Requires standard override permission
        if (!OverrideLegalNetwork) return false;
        // Block if parent opp was already manually assigned
        if (this.oppData?.fields?.Opportunity__r?.value?.fields
                ?.Legal_Network_Assignment_Reason__c?.value === 'Based on Manual Assignment') return false;
        // Allow only when current Legal Network is Victory Legal Plan
        return this.oppData?.fields?.Legal_Network__c?.value === 'Victory Legal Plan';
    }

    showToast(title, variant, msg) {
        const event = new ShowToastEvent({
            title: title,
            variant: variant,
            message: msg
        });
        this.dispatchEvent(event);
    }

    getContractDetails(recordId, apiName) {
        getSendContractDetails({ oppId: recordId, qiuckActionName: apiName })
            .then(result => {
                this.recordWrapper = JSON.parse(JSON.stringify(result));
                this._recordId = recordId;
                if (this.wiredData?.data) this.opportunity(this.wiredData);
                //Forming dynamic URL based on the docusign gen template Id and title
                this.baseUri = `/apex/SendContract?sId=${this.recordId}&templateId=${this.recordWrapper.genTemplateId}&recordId=${this.recordId}&title=${this.recordWrapper.genTemplateTitle}`;
                
                // Show re-evaluation modal after loading
                this.showReEvaluationModal = true;
            }).catch(error => {
                this.showToast('Failed to retrieve the record', 'error', error.body.message);
            });
    }

    handleChange(event) {
       let data =  this.recordFormTosave[event.target.dataset.objectname];
       data[event.target.fieldName] = event.target.value;
       this.recordFormTosave[event.target.dataset.objectname] = data;
    }
    handleValidate() {
        let routingValue;
        if(this.recordFormTosave['Account'].Bank_Routing_Number__c) {
            routingValue = this.recordFormTosave['Account'].Bank_Routing_Number__c;
        } else {
            routingValue = this.oppData?.fields?.Account?.value?.fields?.Bank_Routing_Number__c?.value;
        }

        let accountId = this.oppData?.fields?.Account?.value?.id;
        let oppId = this.recordId;
        if(BypassRoutingNumberValidation) {
            this.validateCompletedPayment(oppId, accountId);
            return;
        }
        this.showSpinner = true;

        validateRoutingNumber({
            routingNumber: routingValue,
            accountId: accountId
        })
        .then(res => {
            this.showSpinner = false;
            if (!res.isValid) {
                this.dispatchEvent(
                    new ShowToastEvent({
                        title: 'Error',
                        message: res.message,
                        variant: 'error'
                    })
                );
            } else {
                 this.validateCompletedPayment(oppId, accountId);
            }
        })
        .catch(error => {
            this.showSpinner = false;
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Validation Error',
                    message: error.body?.message || 'Unexpected error occurred',
                    variant: 'error'
                })
            );
        });
    }

    checkPaymentBeforeSave() {
        
        if(!this.validateFields()) {
            this.showSpinner = false;
            this.showToast('Error', 'error','Required Fields are missing to update the details');
            return;
        }
        this.handleValidate();
    }

    handleSave() {
        this.showSpinner = true;
        let accountId = this.oppData?.fields?.Account?.value?.id;
        let contactId = this.oppData?.fields?.Account?.value?.fields?.Primary_Contact__r?.value?.id;
        let oppId = this.recordId;
        let isChanged = false;
        
        // Only stamp manual assignment reason if user actually changed the Legal Network value
        const originalLegalNetwork = this.oppData?.fields?.Legal_Network__c?.value;
        const newLegalNetwork = this.recordFormTosave['Opportunity']['Legal_Network__c'];
        if (this.isLegalNetworkEditable
            && newLegalNetwork
            && newLegalNetwork !== originalLegalNetwork) {
            this.recordFormTosave['Opportunity']['Legal_Network_Assignment_Reason__c'] = 'Based on Manual Assignment';
        }

        // Only stamp manual assignment reason if user actually changed the Addendum Required value
        const originalAddendumRequired = this.oppData?.fields?.Addendum_Required__c?.value;
        const newAddendumRequired = this.recordFormTosave['Opportunity']['Addendum_Required__c'];
        if (this.isAddendumEditable
            && newAddendumRequired !== undefined
            && newAddendumRequired !== originalAddendumRequired) {
            this.recordFormTosave['Opportunity']['Addendum_Required_Reason__c'] = 'Manual Assignment';
        }

        if(Object.keys(this.recordFormTosave['Opportunity']).length) {
            this.recordFormTosave['Opportunity']['Id'] = oppId;
            isChanged = true;
        } else {
            this.recordFormTosave['Opportunity'] = null;
        }

        if(Object.keys(this.recordFormTosave['Contact']).length) {
            this.recordFormTosave['Contact'].AccountId = accountId;
            this.recordFormTosave['Contact']['Id'] = contactId;
            isChanged = true;
        } else {
            this.recordFormTosave['Contact'] = null;
        }

        if(Object.keys(this.recordFormTosave['Account']).length) {
            this.recordFormTosave['Account']['Id'] = accountId;
            isChanged = true;
        } else {
            this.recordFormTosave['Account'] = null;
        }        
       if(isChanged) {
        saveContractDetails({ 
            account:   this.recordFormTosave['Account'] ,
            contact: this.recordFormTosave['Contact'], 
            opportunity: this.recordFormTosave['Opportunity']
        }).then((result) => {
            this.showSpinner = false;
            this.isSaved = true;
            refreshApex(this.wiredData);
        }) 
        .catch((error) => {
            this.showToast('Failed to retrieve the record', 'error', error.body.message);
            this.showSpinner = false;
        })
       } else {
        this.showSpinner = false;
        this.isSaved = true;
        refreshApex(this.wiredData);
       }
    }
    validateFields() {
        let isValid = [...this.template.querySelectorAll("lightning-input-field")].reduce((validSoFar, field) => {
            return (validSoFar && field.reportValidity());
        }, true);

        return isValid;
    }

    @wire(getRecord, { recordId: "$recordId", fields: ALL_OPP_FIELDS })
    opportunity(result) {
        this.wiredData = result;
        if (result &&result.data) {
            this.oppData =  result.data;
            let fields = getEmptyFields(result.data, FIELDS);
            let accountId = this.oppData?.fields?.Account?.value?.id;
            let contactId = this.oppData?.fields?.Account?.value?.fields?.Primary_Contact__r?.value?.id;

            let accFieldsToEnter = extractRelatedFields(ACCOUNT_FIELDS, 'Primary_Contact__r', false);
            let bankAccountFields = accFieldsToEnter.splice(accFieldsToEnter.length - 4);
            let conFieldsToEnter = extractRelatedFields(ACCOUNT_FIELDS, 'Primary_Contact__r', true);

            if (!this.recordWrapper) {
                return;
            }
            let debtFields = getEmptyDebtFieldsFromArray(this.recordWrapper.debtDetails);
            let debtScheduleFields = getEmptyFieldsFromArray(this.recordWrapper.debtSchedules, DEBT_SCHEDULE_FIELDS);
            let draftFields = getEmptyFieldsFromArray(this.recordWrapper.drafts, DRAFT_FIELDS);
            let oppDisabledFields = this.isLegalNetworkEditable
                ? ['Current_Total_Debt__c', 'Legal_Network_Assignment_Reason__c']
                : ['Current_Total_Debt__c', 'Legal_Network__c', 'Legal_Network_Assignment_Reason__c'];
            if (!this.isAddendumEditable) {
                oppDisabledFields.push('Addendum_Required__c');
            }
            this.recordForms = [
                {objectName :ACCOUNT_OBJECT.objectApiName, recordId :accountId, fields: convertFieldsIntoObjects(accFieldsToEnter, []), label:'Account', isShowTab : accFieldsToEnter.length ? true : false},
                {objectName :ACCOUNT_OBJECT.objectApiName, recordId :accountId, fields: convertFieldsIntoObjects(bankAccountFields, []), label:'Account', isShowTab : bankAccountFields.length ? true : false},
                {objectName :CONTACT_OBJECT.objectApiName, recordId : contactId, fields: convertFieldsIntoObjects(conFieldsToEnter, []), label:'Contact', isShowTab : conFieldsToEnter.length ? true : false},
                {objectName :OPPORTUNITY_OBJECT.objectApiName, recordId : this.recordId, fields: convertFieldsIntoObjects(OPPORTUNITY_FIELDS, oppDisabledFields, ['Addendum_Required__c']), label:'Opportunity', isShowTab : OPPORTUNITY_FIELDS.length ? true : false},
            ];

            this.isShowError = true;
            this.message = 'Review the following Details';
            if(!this.isSaved) {
                return;
            }

            this.errorMessages = [];
            
            /*if(CLOSED_STAGES.indexOf(result.data.fields.StageName.value) != -1) {
                this.errorMessages.push( OPPORTUNITY_CLOSED_NOT_FOUND + ' ' + result.data.fields.StageName.value);
            }*/
            
            if(!this.recordWrapper.debtDetails.length) {
                this.errorMessages.push(DEBT_RECORD_NOT_FOUND);
            }
            if(!this.recordWrapper.debtSchedules.length) {
                this.errorMessages.push(DEBT_SCHEDULE_RECORD_NOT_FOUND);
            }
            if(!this.recordWrapper.drafts.length) {
                this.errorMessages.push(DRAFT_RECORD_NOT_FOUND);
            } 
        
            let isValidPaymentCalculation = getIsEmptyCheck(result.data, OPP_FIELDS);
            if (debtScheduleFields.length || draftFields.length) {
                isValidPaymentCalculation = false;
            }
            if (!isValidPaymentCalculation) {
                this.errorMessages.push('Please reschedule the program before you send the contract.');
            }

            if (result.data.fields.Current_Total_Debt__c.value != result.data.fields.Total_Debt__c.value) {
                this.errorMessages.push('Debt amount is changed, Please re-calculate the program amount to send contract.');
            } 

            if(this.errorMessages.length) {
                this.isShowError = true;
                this.message = 'Please review the following details';
                return;
            }

            if (!this.completed) {
                this.completed = true;
                this.dispatchEvent(new CustomEvent('reviewcomplete'));
            }
        }
    };

    close() {
        this.dispatchEvent(new CloseActionScreenEvent());
    }

     validateCompletedPayment(oppId, accId) {
        checkCompletedPaymentValidation({ 
            opportunityId: oppId, 
            clientId: accId 
        })
        .then(result => {
            let isCompletedValid = result;
            console.log('Completed Payment Valid:', result);
                if (!isCompletedValid) {
                    this.showToast('Error', 'error', 'Total completed payments do not match the expected amount.Please reschedule before sending contract');
                    return;
                }
                this.handleSave();
        })
        .catch(error => {
            console.error('Error in Completed Payment Validation:', error);
        });
    }

    handleCancelReEvaluation() {
        this.showReEvaluationModal = false;
        // Close the entire send contract modal/screen
        this.dispatchEvent(new CloseActionScreenEvent());
    }

    handleProceedReEvaluation() {
        this.showSpinner = true;
        this.showReEvaluationModal = false;
        
        reEvaluateLegalNetwork({ opportunityId: this.recordId })
            .then(result => {
                this.showSpinner = false;
                
                if (result.success) {
                    this.showToast('Success', 'success', result.message);
                    // Refresh the component to show updated values
                    refreshApex(this.wiredData);
                } else {
                    this.showToast('Error', 'error', result.message);
                }
            })
            .catch(error => {
                this.showSpinner = false;
                const errorMessage = error.body?.message || error.message || 'An unexpected error occurred during re-evaluation';
                this.showToast('Error', 'error', errorMessage);
            });
    }


}