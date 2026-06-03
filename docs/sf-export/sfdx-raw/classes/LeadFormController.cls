public without sharing class LeadFormController {
    
    @AuraEnabled
    public static string saveLeadDetails(String leadDetails, String pageUrl) {
        resultWrapper resltWrap = new resultWrapper();
        resltWrap.result = 'Success';
      //  String result = 'Success';
        if (String.isNotBlank(leadDetails)) {
            Lead leadInstance = (Lead)JSON.deserialize(leadDetails, Lead.class);   
            try {
                String oldDescription;
                String inboundLeadUpdatedMsg;
                leadInstance.Phone = leadInstance.Phone.replaceAll('[^0-9]', ''); 
                if(String.isBlank(leadInstance.Id)){
                    List<Lead> existingInboundLead = [SELECT Id, Description FROM Lead WHERE Formated_Phone__c = :leadInstance.Phone AND FirstName = 'New' AND LastName = 'Inbound' AND CreatedDate = TODAY ORDER BY CreatedDate DESC];
                    if (existingInboundLead != null && !existingInboundLead.isEmpty()){
                        leadInstance.Id = existingInboundLead[0].Id;
                        inboundLeadUpdatedMsg = 'DML: Lead Update; Reason: Inbound Lead found with the same phone number created today.';
                    }
                }
                List<Lead> existingLead = [SELECT Id, Description FROM Lead WHERE Id = :leadInstance.Id];
                if (existingLead != null && !existingLead.isEmpty()) {
                    oldDescription = existingLead[0].Description;
                }
                upsert leadInstance;
                if (oldDescription != leadInstance.Description && String.isNotBlank(leadInstance.Description)) {
                    Task newTask = new Task();
                    newTask.Subject = leadInstance.Description.length() > 250 ? leadInstance.Description.substring(0, 250) : leadInstance.Description ;
                    newTask.ActivityDate = System.today();
                    newTask.WhoId = leadInstance.Id;
                    newTask.Status = 'Completed';
                    insert newTask;
                }
                resltWrap.leadInstance = leadInstance;
                ApplicationLogger.logInfoLog(pageUrl,
                    JSON.serialize(leadInstance),
                    'Lead upserted via site page.',
                    leadInstance.Id,inboundLeadUpdatedMsg
                );
            } catch (Exception ex) {
                resltWrap.result = ex.getMessage();
                ApplicationLogger.logException(ex, leadInstance.Id);
            }
        }
        return JSON.serialize(resltWrap);
    }

    @AuraEnabled
    public static String getLeadDetails(String recordId) {
        String leadString;
        List<Lead> leadDetails = [
            SELECT Id, Lead_Id__c, FirstName, LastName, SSN__c, EIN_Number_Tax_Id__c, Date_Of_Birth__c, Gender__c,
            Country_Code__c, Phone, MobilePhone, Work_Phone__c, Company, Lead_Vendor_Id_Text__c, UCC_filing_Date__c,
            Business_Start_Date__c, Description, Email, Alternate_Email__c, UTM_Term__c,Has_Calendly_Event__c,
            Street, City, State, Country, PostalCode, Frequency__c,
            Industry, Lenders__c, Monthly_Revenue__c, MCA_Amount__c
            FROM Lead WHERE Id = :recordId LIMIT 1
        ];
        System.debug('leadDetails--->'+leadDetails);
        if (leadDetails != null && !leadDetails.isEmpty()) {
            leadString = JSON.serialize(leadDetails[0]);
        }
        return leadString;
    }
    
    @AuraEnabled
    public static String updateCallTransferDetails(String recordId, WorksheetUserWrapper transferDetails) {
        String result = 'Success';
        try {
            List<Lead> leads = LeadData.getLeadList(new List<Object>{'FronterLookup__c', 'Call_Transferred_By_Lookup__c', 'Call_Tranferred_DateTime__c', 'Sub_Disposition__c','Status','Call_Transfer_Status__c'}, new Set<Id>{recordId});
            leads[0].FronterLookup__c = transferDetails.userId;
            leads[0].Call_Transferred_By_Lookup__c = transferDetails.userId;
            leads[0].Call_Tranferred_DateTime__c =  Datetime.valueOf(transferDetails.callTransferredDateTime.replace('T', ' '));
            leads[0].Description = transferDetails.description;
            update leads;
            
            
            if(transferDetails.userId == null) {
                 ApplicationLogger.logErrorWithSeverity(transferDetails.currentPageUrl, 
                 'TO worksheet Update: User not found.', leads[0].Id, 'High');
            }
            
            
        } catch (Exception ex) {
            result = ex.getMessage();
            ApplicationLogger.logException(ex, recordId);
        }
        return result;
    }
    
    @AuraEnabled
    public static String getLeadSourceByPhone(String toPhoneNumber){
        String leadSource;
        try{
            leadSource = InboundPhoneLeadSourceMdt.getInboundPhoneLeadSource(toPhoneNumber);
        } catch(Exception ex) {
            ApplicationLogger.logException(ex,Null,'LeadFormController.getLeadSourceByPhone',Null);
        }
        return leadSource;
    }

    @AuraEnabled(cacheable=true)
    public static List<User> getUserByEmail(String email) {
        return UserData.getUserByEmail(email);
    }

    @AuraEnabled(cacheable = true)
    public static Id getWebLeadRecordTypeId(){
        return LeadUtil.getRecordTypeId(LeadUtil.RT_WEB_LEAD);
    }
    
    public class resultWrapper {
       public string result;
       public Lead leadInstance;
    }

    public class WorksheetUserWrapper {
        @AuraEnabled public String fronter{get;set;}
        @AuraEnabled public String callTransferredBy{get;set;}
        @AuraEnabled public String userId{get;set;}
        @AuraEnabled public String currentPageUrl{get;set;}
        @AuraEnabled public String description{get;set;}
        @AuraEnabled public String callTransferredDateTime{get;set;}
    }
}