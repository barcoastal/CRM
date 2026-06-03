public with sharing class SMSInboxController {
    @AuraEnabled
    public static ApexActionResult fetchCurrentRecordDetails(Id recordId) {
        final String SCOPE = 'SMSInboxController.fetchCurrentRecordDetails';
        ApexActionResult result = new ApexActionResult(SCOPE);
        try {
            if (recordId != null) {
                Set<String> phoneNumbers = new Set<String>();
                String sObjectName = ApexUtil.getSObjectName(recordId);
                if (String.isNotBlank(sObjectName)) {
                    if (sObjectName == new LeadUtil().getSObjName()) {
                        List<Lead> leads = LeadData.queryLeadsPhoneNumbers(recordId);
                        if (leads != null && !leads.isEmpty()) {
                            for (Lead leadRecord : leads) {
                                if (leadRecord.Phone != null) {
                                    phoneNumbers.add('Phone: ' + leadRecord.Phone);
                                } 
                                if (leadRecord.MobilePhone != null) {
                                    phoneNumbers.add('Mobile Phone: ' + leadRecord.MobilePhone);
                                } 
                                if (leadRecord.Work_Phone__c != null) {
                                    phoneNumbers.add('Work Phone: ' + leadRecord.Work_Phone__c);
                                }
                            }
                        }
                    } else if (sObjectName == new AccountUtil().getSObjName()) {
                        List<Account> accounts = AccountData.queryAccountsPhoneNumbers(recordId);
                        if (accounts != null && !accounts.isEmpty()) {
                            for (Account accountRecord : accounts) {
                                if (accountRecord.Phone != null) {
                                    phoneNumbers.add('Phone: ' + accountRecord.Phone);
                                } 
                                if (accountRecord.PersonMobilePhone != null) {
                                    phoneNumbers.add('Mobile Phone: ' + accountRecord.PersonMobilePhone);
                                } 
                                if (accountRecord.Work_Phone__c != null) {
                                    phoneNumbers.add('Work Phone: ' + accountRecord.Work_Phone__c);
                                }
                            }
                        }
                    } else if (sObjectName == new ContactUtil().getSObjName()) {
                        List<Contact> contacts = ContactData.queryContactsPhoneNumbers(recordId);
                        if (contacts != null && !contacts.isEmpty()) {
                            for (Contact contactRecord : contacts) {
                                if (contactRecord.Phone != null) {
                                    phoneNumbers.add('Phone: ' + contactRecord.Phone);
                                } 
                                if (contactRecord.MobilePhone != null) {
                                    phoneNumbers.add('Mobile Phone: ' + contactRecord.MobilePhone);
                                }
                            }
                        }
                    }
                }
                result.data = phoneNumbers;
            }
        } catch (Exception ex) {
            result.thrown(ex);
        }
        return result;
    }

    @AuraEnabled
    public static ApexActionResult sendSMS(String smsWrap) {
        final String SCOPE = 'SMSInboxController.sendSMS';
        ApexActionResult result = new ApexActionResult(SCOPE);
        SMSWrapper smsWrapInstance;
        String errorMessage;
        try { 
            ApexUtil.requireValue('SMS Wrapper', smsWrap);
            String errMsg = '';
            String toNumber;
            String message;
            smsWrapInstance = (SMSWrapper)JSON.deserialize(smsWrap, SMSWrapper.class);
            Map<String, Object> programPlanMap = (Map<String, Object>) JSON.deserializeUntyped(smsWrap);
            if (String.isBlank(smsWrapInstance.toPhone)) {
                errMsg += 'To Number should not be blank. ';
            }
            if (String.isBlank(smsWrapInstance.smsBody)) {
                errMsg += 'SMS Body should not be blank. ';
            }
            if (String.isNotBlank(errMsg)) {
                result.status = ApexActionResult.Statuses.ERROR;
                result.message = errMsg;
            } else {
                TwilioConfigSettings twilioSettings = new TwilioConfigSettings();
                smsWrapInstance.fromPhone = twilioSettings.fromPhone;
                Map<String,String> properties = new Map<String,String>(); 
                String toPhone;
                if (String.isNotBlank(smsWrapInstance.toPhone) && !smsWrapInstance.toPhone.startsWith(SMSWrapper.PH_PREFIX)) {
                    toPhone = SMSWrapper.PH_PREFIX + smsWrapInstance.toPhone;
                }
                properties.put('To',toPhone); 
                properties.put('From',smsWrapInstance.fromPhone);
                properties.put('Body',smsWrapInstance.smsBody);
                TwilioRestClient client = new TwilioRestClient(twilioSettings.accountSId, twilioSettings.authToken);
                TwilioMessage twilioMsgResult = client.getAccount().getMessages().create(properties);
                result.status = ApexActionResult.Statuses.SUCCESS;
                result.message = 'Message is sent successfully.';
            }
        } catch (Exception ex) {
            result.thrown(ex);
            errorMessage = result.message;
        } finally {
            SMS__c smsRecord = smsWrapInstance.getSMSInstance();
            if (result.status == ApexActionResult.Statuses.SUCCESS) {
                smsRecord.Outbound_Failure_Reason__c = null;
            } else {
                smsRecord.Outbound_Failure_Reason__c = errorMessage;
            }
            upsert smsRecord;
        }
        return result;
    }

    @AuraEnabled
    public static ApexActionResult querySMSRecords(String phoneNo) {
        final String SCOPE = 'SMSInboxController.querySMSRecords';
        ApexActionResult result = new ApexActionResult(SCOPE);
        try {
            if (String.isNotBlank(phoneNo)) {
                List<SMSWrapper> smsWrapperList = new List<SMSWrapper>();
                for (SMS__c smsRecord : SMSData.querySMS(phoneNo)) {
                    SMSWrapper smsWrap = new SMSWrapper(smsRecord);
                    smsWrapperList.add(smsWrap);
                }
                result.data = JSON.serialize(smsWrapperList);
            }
        } catch (Exception ex) {
            result.thrown(ex);
        }
        return result;
    }

    /**
     * @description: method to query the sms templates
     * @param1: Id recordId - Id of the Lead/Account/contact record
     * @returnType: ApexActionResult with the result of the sms templates.
    */
    @AuraEnabled
    public static ApexActionResult querySMSTemplates(Id recordId) {
        final String SCOPE = 'SMSInboxController.querySMSTemplates';
        ApexActionResult result = new ApexActionResult(SCOPE);
        try {
            if (String.isNotBlank(recordId)) {
                String sObjectName = ApexUtil.getSObjectName(recordId);
                List<SMSTemplate> templatesWrapList = new List<SMSTemplate>();
                for (SMS_Template__mdt smsTemplate : SMSTemplateData.queryRecords(sObjectName)) {
                    SMSTemplate templateWrap = new SMSTemplate(smsTemplate);
                    templatesWrapList.add(templateWrap);
                }
                result.data = JSON.serialize(templatesWrapList);
            }
        } catch (Exception ex) {
            result.thrown(ex);
        }
        return result;
    }

    /**
     * @description: method to merge the fields in the SMS body
     * @param1: Id recordId - Id of the Lead/Account/contact record
     * @param2: String smsBody - the sms body with the custom merge fields
     * @returnType: ApexActionResult with the result of the sms body with the replacement of merge fields.
    */
    @AuraEnabled
    public static ApexActionResult mergeFieldsInSMS(Id recordId, String smsBody) {
        final String SCOPE = 'SMSInboxController.mergeFieldsInSMS';
        ApexActionResult result = new ApexActionResult(SCOPE);
        try {
            if (String.isNotBlank(recordId) && String.isNotBlank(smsBody)) {
                Set<String> userFields = CustomMergeFields.getUserFieldsFromSMS(smsBody);
                if (userFields != null && !userFields.isEmpty()) {
                    List<User> userRecords = UserData.queryCurrentUser(userFields);
                    if (userRecords != null && !userRecords.isEmpty()) {
                        smsBody = CustomMergeFields.mergeFields(smsBody, userFields, userRecords[0]);
                    }
                }
                Set<String> fields = CustomMergeFields.getFieldsFromSMS(smsBody);
                if (fields != null && !fields.isEmpty()) {
                    String sObjectName = ApexUtil.getSObjectName(recordId);
                    if (String.isNotBlank(sObjectName)) {
                        SObject sObjRecord;
                        if (sObjectName == new LeadUtil().getSObjName()) {
                            List<Lead> leads = LeadData.queryLead(recordId, fields);
                            sObjRecord = leads[0];
                        } else if (sObjectName == new AccountUtil().getSObjName()) {
                            List<Account> accounts = AccountData.queryAccount(recordId, fields);
                            sObjRecord = accounts[0];
                        } else if (sObjectName == new ContactUtil().getSObjName()) {
                            List<Contact> contacts = ContactData.queryContact(recordId, fields);
                            sObjRecord = contacts[0];
                        }
                        if (sObjRecord != null) {
                            smsBody = CustomMergeFields.mergeFields(smsBody, fields, sObjRecord);
                        }
                    }
                }
            }
            result.data = smsBody;
        } catch (Exception ex) {
            result.thrown(ex);
        }
        return result;
    }
}