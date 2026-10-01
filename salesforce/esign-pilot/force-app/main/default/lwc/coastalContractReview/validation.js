import OPP_NAME from "@salesforce/schema/Opportunity.Name";
import OPP_STAGE_NAME from "@salesforce/schema/Opportunity.StageName";

import OPP_PAYMENT_TERM from "@salesforce/schema/Opportunity.DS_Payment_Term__c";
import ACCOUNT_NAME from "@salesforce/schema/Opportunity.Account.Name";
import ACCOUNT_EIN from "@salesforce/schema/Opportunity.Account.EIN_Number_Tax_Id__c";
import ACCOUNT_BILLING_CITY from "@salesforce/schema/Opportunity.Account.BillingCity";
import ACCOUNT_BILLING_COUNTRY from "@salesforce/schema/Opportunity.Account.BillingCountry";
import ACCOUNT_BILLING_STATE from "@salesforce/schema/Opportunity.Account.BillingState";
import ACCOUNT_BILLING_STREET from "@salesforce/schema/Opportunity.Account.BillingStreet";
import ACCOUNT_BILLING_POSTAL_CODE from "@salesforce/schema/Opportunity.Account.BillingPostalCode";
import ACCOUNT_CONTACT_LNAME from "@salesforce/schema/Opportunity.Account.Primary_Contact__r.LastName";
import ACCOUNT_CONTACT_FNAME from "@salesforce/schema/Opportunity.Account.Primary_Contact__r.FirstName";
import ACCOUNT_CONTACT_BIRTHDATE from "@salesforce/schema/Opportunity.Account.Primary_Contact__r.Birthdate";
import ACCOUNT_CONTACT_EMAIL from "@salesforce/schema/Opportunity.Account.Primary_Contact__r.Email";
import ACCOUNT_CONTACT_PHONE from "@salesforce/schema/Opportunity.Account.Primary_Contact__r.Phone";
import ACCOUNT_BANK_NAME from "@salesforce/schema/Opportunity.Account.Bank_Name__c";
import ACCOUNT_BANK_ROUTING_NUMBER from "@salesforce/schema/Opportunity.Account.Bank_Routing_Number__c";
import ACCOUNT_BANK_ACCOUNT_NUMBER from "@salesforce/schema/Opportunity.Account.Bank_Account_Number__c";
import ACCOUNT_BANK_ACCOUNT_TYPE from "@salesforce/schema/Opportunity.Account.Bank_Account_Type__c";
import ACCOUNT_CONTACT_SSN from "@salesforce/schema/Opportunity.Account.SSN__c";
import ACCOUNT_BILLING_COUNTY from "@salesforce/schema/Opportunity.Account.BillingCounty__c"
import TOTAL_DEBT_FIELD from "@salesforce/schema/Opportunity.Current_Total_Debt__c";
import TOTAL_DEBT_INCLUDED_FIELD from "@salesforce/schema/Opportunity.Total_Debt__c";
import LEGAL_NETWORK from "@salesforce/schema/Opportunity.Legal_Network__c";
import LEGAL_NETWORK_ASSIGNMENT_REASON from "@salesforce/schema/Opportunity.Legal_Network_Assignment_Reason__c";
import ADDENDUM_REQUIRED from "@salesforce/schema/Opportunity.Addendum_Required__c";
import PARENT_OPP_LEGAL_NETWORK_REASON from "@salesforce/schema/Opportunity.Opportunity__r.Legal_Network_Assignment_Reason__c";
import {getFieldValue } from "lightning/uiRecordApi";
import dsEstimatedSettlement from "@salesforce/schema/Opportunity.DS_Estimated_Settlement__c";
import dsEstimatedRetainerFee from "@salesforce/schema/Opportunity.DS_Estimated_Retainer_Fee__c";
import dsEstimatedProgramFee from "@salesforce/schema/Opportunity.DS_Estimated_Program_Fee__c";
import dsTotalAmountWithFees from "@salesforce/schema/Opportunity.DS_Total_Amount_With_Fees__c";
import dsEstimatedAmountYouSave from "@salesforce/schema/Opportunity.DS_Estimated_Amount_You_Save__c";
import dsFirstDepositAmount from "@salesforce/schema/Opportunity.DS_First_Deposit_Amount__c";
import dsFirstPaymentDate from "@salesforce/schema/Opportunity.DS_First_Payment_Date__c";
import dsFirstRetainerSetupFee from "@salesforce/schema/Opportunity.DS_First_Retainer_Setup_Fee__c";
import dsSettlementPercentage from "@salesforce/schema/Opportunity.DS_Settlement_Percentage__c";
import dsProgramFeePercentage from "@salesforce/schema/Opportunity.DS_Program_Fee_Percentage__c";
import dsRetainerPercentage from "@salesforce/schema/Opportunity.DS_Retainer_Percentage__c";
import dsWeeklyServiceFee from "@salesforce/schema/Opportunity.DS_Weekly_Service_Fee__c";
import dsTotalFeePercentage from "@salesforce/schema/Opportunity.DS_Total_Fee_Percentage__c";
import dsTotalDraftAmount from "@salesforce/schema/Opportunity.DS_Total_Draft_Amount__c";
import dsTotalRetainerFee from "@salesforce/schema/Opportunity.DS_Total_Retainer_Fee__c";
import dsTotalSetupFee from "@salesforce/schema/Opportunity.DS_Total_Setup_Fee__c";
import dsTotalProgramFee from "@salesforce/schema/Opportunity.DS_Total_Program_Fee__c";
import dsTotalServiceFee from "@salesforce/schema/Opportunity.DS_Total_Service_Fee__c";
import dsTotalEscrowAmount from "@salesforce/schema/Opportunity.DS_Total_Escrow_Amount__c";
import TotalAmount from "@salesforce/schema/Opportunity.Total_Debt__c";
import OPP_EMAIL from "@salesforce/schema/Opportunity.Email__c";
import DEBT_AMOUNT from "@salesforce/schema/Debt_Details__c.Debt_Amount__c";
import CREDITOR_NAME from "@salesforce/schema/Debt_Details__c.Creditor_Name__c";
import CURRENT_CREDITOR_NAME from "@salesforce/schema/Debt_Details__c.Current_Creditor__r.Name";

import DEBT_DRAFT_DATE from "@salesforce/schema/Draft__c.Draft_Date__c";
import DEBT_DRAFT_AMOUNT from "@salesforce/schema/Draft__c.Draft_Total_Amount__c";
import DEBT_DRAFT_RETAINER_FEE from "@salesforce/schema/Draft__c.Retainer_Fee__c";
import DEBT_DRAFT_SETUPFEE from "@salesforce/schema/Draft__c.Setup_Fee__c";
import DEBT_PROGRAM_FEE from "@salesforce/schema/Draft__c.Program_Fee__c";
import DEBT_DRAFT_SERVICE_FEE from "@salesforce/schema/Draft__c.Service_Fee__c";
import DEBT_DRAFT_DRAF_TAMOUNT from "@salesforce/schema/Draft__c.Draft_Amount__c";

import DEBT_SCHEEDULE_AMOUNT from "@salesforce/schema/Debit_Schedule__c.Deposit_Amount__c";
import DEBT_SCHEEDULE_DATE from "@salesforce/schema/Debit_Schedule__c.Start_Date__c";
import DEBT_SCHEEDULE_NO_PAYMENTS from "@salesforce/schema/Debit_Schedule__c.Number_of_Payments__c";


import { getValueFromObject } from "c/utils";
export const ACCOUNT_FIELDS = [
  ACCOUNT_NAME, ACCOUNT_EIN, ACCOUNT_BILLING_STREET, ACCOUNT_BILLING_CITY, ACCOUNT_BILLING_STATE,ACCOUNT_BILLING_COUNTY, ACCOUNT_BILLING_POSTAL_CODE, ACCOUNT_BILLING_COUNTRY,ACCOUNT_BANK_NAME,
  ACCOUNT_BANK_ROUTING_NUMBER, ACCOUNT_BANK_ACCOUNT_NUMBER, ACCOUNT_BANK_ACCOUNT_TYPE, ACCOUNT_CONTACT_FNAME , ACCOUNT_CONTACT_LNAME, ACCOUNT_CONTACT_PHONE,ACCOUNT_CONTACT_EMAIL,
   ACCOUNT_CONTACT_SSN, ACCOUNT_CONTACT_BIRTHDATE];

export const OPPORTUNITY_FIELDS = [OPP_NAME, OPP_EMAIL, TOTAL_DEBT_FIELD, TOTAL_DEBT_INCLUDED_FIELD, LEGAL_NETWORK, LEGAL_NETWORK_ASSIGNMENT_REASON, ADDENDUM_REQUIRED];
export const FIELDS = [...OPPORTUNITY_FIELDS , ...ACCOUNT_FIELDS];

export const OPP_FIELDS = [dsEstimatedSettlement, dsEstimatedRetainerFee, dsEstimatedProgramFee, dsTotalAmountWithFees, dsEstimatedAmountYouSave,
    dsFirstDepositAmount, dsFirstPaymentDate, dsFirstRetainerSetupFee, dsSettlementPercentage, dsProgramFeePercentage, dsRetainerPercentage,
    dsWeeklyServiceFee, dsTotalFeePercentage, dsTotalDraftAmount, dsTotalRetainerFee, dsTotalSetupFee, dsTotalProgramFee, dsTotalServiceFee,
    dsTotalEscrowAmount, TotalAmount, OPP_PAYMENT_TERM];

export const ALL_OPP_FIELDS = [...FIELDS, ...OPP_FIELDS, OPP_STAGE_NAME, PARENT_OPP_LEGAL_NETWORK_REASON];
export const DEBT_DETAILS_FIELDS = [DEBT_AMOUNT.fieldApiName, CREDITOR_NAME.fieldApiName];
export const DRAFT_FIELDS = [
    DEBT_DRAFT_DATE.fieldApiName, DEBT_DRAFT_AMOUNT.fieldApiName, DEBT_DRAFT_RETAINER_FEE.fieldApiName,
    DEBT_DRAFT_SETUPFEE.fieldApiName, DEBT_PROGRAM_FEE.fieldApiName, DEBT_DRAFT_SERVICE_FEE.fieldApiName, DEBT_DRAFT_DRAF_TAMOUNT.fieldApiName
];
export const DEBT_SCHEDULE_FIELDS = [
  DEBT_SCHEEDULE_AMOUNT.fieldApiName,
  DEBT_SCHEEDULE_NO_PAYMENTS.fieldApiName,
  DEBT_SCHEEDULE_DATE.fieldApiName
];

export function getEmptyDebtFieldsFromArray(objList) {
  let items = [];

  for(let i=0;i<objList.length;i++) {
    let fields = [];
    if(!getValueFromObject(objList[i], DEBT_AMOUNT.fieldApiName)) {
      fields.push( DEBT_AMOUNT.fieldApiName);
    }
    if(!getValueFromObject(objList[i], CREDITOR_NAME.fieldApiName) && !getValueFromObject(objList[i], CURRENT_CREDITOR_NAME.fieldApiName)) {
      fields.push(CREDITOR_NAME.fieldApiName);
      fields.push(CURRENT_CREDITOR_NAME.fieldApiName);
    }
    items = [...new Set([...items, ...fields])];
  }
  return items;
}

export function getEmptyFields(obj, fieldsToCheck, isNotGetFromRecordData) {
    const emptyFields = [];
  
    if (!obj || typeof obj !== 'object') {
      throw new Error('Invalid input object');
    }
  
    if (!Array.isArray(fieldsToCheck)) {
      throw new Error('Fields to check must be an array');
    }
    
    for (const field of fieldsToCheck) {
        let value =   isNotGetFromRecordData ? obj[field] : getFieldValue(obj, field);
        if (( value === null || value === undefined || value === '')) {
          let fieldName = isNotGetFromRecordData ? field : field.fieldApiName;
            emptyFields.push(fieldName);
        }
    }

    return emptyFields;
  }

  export function getIsEmptyCheck(obj, fieldsToCheck) {
    let isValid = true;
    for (const field of fieldsToCheck) {
        let value = getFieldValue(obj, field);
        if (( value === null || value === undefined || value === '')) {
            isValid = false;
        }
    }
    return isValid;
  }
  
  export function getEmptyFieldsFromArray(objList, fieldsToCheck) {
    let items = [];

    for(let i=0;i<objList.length;i++) {
      let fields = getEmptyFields(objList[i], fieldsToCheck, true);
      items = [...new Set([...items, ...fields])];
    }
    return items;
  }

  export function extractRelatedFields(fields, relationshipName, isInclude) {
    const relatedFields = [];
    fields.forEach(field => {
      field = field.fieldApiName;
      if (isInclude && field.includes(relationshipName)) {
        const relatedField = field.split(relationshipName + '.')[1];
        if (relatedField) {
          relatedFields.push(relatedField);
        }
      }
      if (!isInclude && !field.includes(relationshipName)) {
        relatedFields.push(field.split('.')[1]);
      }
    });
    return relatedFields;
  }

  export function convertFieldsIntoObjects(fields , disabledFields, nonRequiredFields = []) {

    return fields.map((field) => {
      field = (field.fieldApiName ? field.fieldApiName : field );
      let isDisabled = false;
      if(disabledFields.indexOf(field) != -1) {
        isDisabled = true;
      }
      let isRequired = nonRequiredFields.indexOf(field) === -1;

      return {'fieldApiName':field,'isDisabled':isDisabled,'isRequired':isRequired}
    })

  }