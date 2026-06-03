/**
 * @Description: 
 * 
 * History: 
 * 06/13/2023 - Ajith Muppidi - DBST-108
 * Mapping total Debt to Current_Total_Debt_Amount__c a formula field. This formula field is Sum of all Creditor total debt. 
 * Removing Formula fields from LeaSobject serialization in convertLeadWrapToLeadSobject method. 
 */
public with sharing class LeadPaymentCalcController {
    @AuraEnabled
    public static ApexActionResult getRecordTypeDeveloperName(Id leadId) {
        final String SCOPE = 'LeadPaymentCalcController.getRecordTypeDeveloperName';
        ApexActionResult result = new ApexActionResult(SCOPE);
        try {
            ApexUtil.requireValue('Lead Id', leadId);
            List<Lead> leads = LeadData.queryLeadRecordType(leadId);
            if (!leads.isEmpty()) {
                result.data = leads[0];
            }
        } catch (Exception ex) {
            result.thrown(ex);
        }
        return result;
    }

    @AuraEnabled
    public static ApexActionResult getRecordTypeBasedOnRTName(String recordTypeName) {
        final String SCOPE = 'LeadPaymentCalcController.getRecordTypeBasedOnRTName';
        ApexActionResult result = new ApexActionResult(SCOPE);
        try {
            ApexUtil.requireValue('RecordType Name', recordTypeName);
            List<RecordType> recordTypes = LeadData.queryRecordTypes(recordTypeName);
            if (!recordTypes.isEmpty()) {
                result.data = recordTypes[0];
            }
        } catch (Exception ex) {
            result.thrown(ex);
        }
        return result;
    }

    @AuraEnabled
    public static ApexActionResult checkIsAgentProfile() {
        final String SCOPE = 'LeadPaymentCalcController.checkIsAgentProfile';
        ApexActionResult result = new ApexActionResult(SCOPE);
        try {
            Id currentProfileId = UserInfo.getProfileId();
            List<Profile> profileInstance = ProfileData.queryProfile(currentProfileId);
            if (profileInstance != null && !profileInstance.isEmpty()
                && profileInstance[0].Name.containsIgnoreCase('Agent')
            ) {
                result.data = 'isAgent';
            } else {
                result.data = 'isAdmin';
            }
        } catch (Exception ex) {
            result.thrown(ex);
        }
        return result;
    }

    @AuraEnabled
    public static ApexActionResult saveLeadDetails(String leadDetails) {
        final String SCOPE = 'LeadPaymentCalcController.saveLeadDetails';
        ApexActionResult result = new ApexActionResult(SCOPE);
        try {
            LeadWrapper leadWrap = (LeadWrapper)JSON.deserialize(leadDetails, LeadWrapper.class);
            Lead leadSObj = convertLeadWrapToLeadSobject(leadWrap);
            upsert leadSObj;
        } catch (Exception ex) {
            result.thrown(ex);
        }
        return result;
    }

    @AuraEnabled
    public static ApexActionResult getCurrentRecordDetails(Id leadId) {
        final String SCOPE = 'LeadPaymentCalcController.getCurrentRecordDetails';
        ApexActionResult result = new ApexActionResult(SCOPE);
        try {
            ApexUtil.requireValue('Lead Id', leadId);
            List<String> fields = leadWrapperLeadSobjMapping.values();
            List<Lead> leads = LeadData.queryLeadDetails(leadId, fields);
            if (!leads.isEmpty()) {
                result.data = constructLeadWrapper(leads[0]);  
            }
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
        return result;
    }

    @AuraEnabled
    public static ApexActionResult getPaymentCalcSettings() {
        final String SCOPE = 'LeadPaymentCalcController.getPaymentCalcSettings';
        ApexActionResult result = new ApexActionResult(SCOPE);
        try {
            result.data = JSON.serialize(new PaymentCalculatorSettings());  
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
        return result;
    }

    private static String constructLeadWrapper(Lead leadObj) {
        LeadWrapper leadWrap = new LeadWrapper();
        Map<String, Object> leadWrapMap = new Map<String, Object>();
        for (String leadWrapKey : leadWrapperLeadSobjMapping.keySet()) {
            String leadFieldName = leadWrapperLeadSobjMapping.get(leadWrapKey);
            leadWrapMap.put(leadWrapKey, leadObj.get(leadFieldName));
        }
        return JSON.serialize(leadWrapMap);
    }

    /** Adding logic to skip formula field while creating LeadSObject.  */
    private static Lead convertLeadWrapToLeadSobject(LeadWrapper leadWrap) {
        Lead leadSobj = new Lead();
        Map<String, Object> leadWrapUntypedMap = (Map<String, Object>)JSON.deserializeUntyped(JSON.serialize(leadWrap));
        for (String leadWrapAttribute : leadWrapperLeadSobjMapping.keySet()) {
            String leadSObjField = leadWrapperLeadSobjMapping.get(leadWrapAttribute);
            if (decimalFields.contains(leadSObjField)) {
                Object fieldValue = leadWrapUntypedMap.get(leadWrapAttribute);
                if (fieldValue != null) {
                    leadSobj.put(leadSObjField, Decimal.valueOf(String.valueOf(fieldValue)));
                }
            } else if (formulaFields.contains(leadSObjField)) {
                continue; 
            } else {
                leadSobj.put(leadSObjField, leadWrapUntypedMap.get(leadWrapAttribute));
            }
        } 
        return leadSobj;
    }

    public class LeadWrapper {
        public String recordId;
        public String totalDebt;
        public String paymentTermValue;
        public String paymentFrequencyValue;
        public String downPayment;
        public String retainerPercentValue;
        public String settlementPercentValue;
        public String programFeePercentValue;
        public String monthlyBankFee;
        public String setupFeeValue;
    }

    /** Mapping totalDebt to Current Totaldebt Amount formula field */
    public final static Map<String, String> leadWrapperLeadSobjMapping = new Map<String, String> {
        'recordId' => 'Id',
        'totalDebt' => 'Current_Total_Debt_Amount__c',
        'paymentTermValue' => 'Payment_Term__c',
        'paymentFrequencyValue' => 'Frequency__c',
        'downPayment' => 'Down_Payment__c',
        'retainerPercentValue' => 'Retainer_Percentage__c',
        'settlementPercentValue' => 'Settlement_Percentage__c',
        'programFeePercentValue' => 'Program_Fee_Percentage__c',
        'monthlyBankFee' => 'Monthly_Bank_Fee__c',
        'setupFeeValue' => 'Setup_Fee__c'
    };

    public final static Set<String> decimalFields = new Set<String> {
        'Total_Debt_Amount__c', 'Down_Payment__c', 'Monthly_Bank_Fee__c'
    };

    public final static Set<String> formulaFields = new Set<String> {
        'Current_Total_Debt_Amount__c'
    };
}