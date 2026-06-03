/**
 * 
 * @Description: Event Handler to process Application_event__e records. When an Event is generated, a coresponding custom record is creatd. 
 *               
 */
public Inherited sharing class ApplicationEventHandler {

/**
 * @description method to process Platform events and Insert Application Logs 
 * @param newEvents : New Events for which Application_Log__c recrods should be created. 
 */
    public static void execute(List<Application_Event__e> newEvents){

        List<Application_Log__c> applicationLogs = new List<Application_Log__c>(); 

        for (Application_Event__e event : newEvents) {

            Application_Log__c log = new Application_Log__c(); 
            log.Callout_End_Point__c = event.Callout_End_Point__c;
            log.Callout_Request__c = event.Callout_Request__c; 
            log.Callout_Response__c = event.Callout_Response__c; 
            log.Exception_Message__c = event.Exception_Message__c; 
            log.Exception_StackTrace__c = event.Exception_StackTrace__c; 
            log.Statement__c = event.Statement__c; 
            log.Log_Type__c = event.Log_Type__c; 
            log.Record_Id__c = event.Record_Id__c; 
            log.Severity__c = event.Severity__c;
            if (String.isNotBlank(event.Record_Id__c)) {
                if (event.Record_Id__c.startsWith(ApexUtil.getKeyPrefix('Lead'))) {
                    log.Lead__c = event.Record_Id__c;
                } else if (event.Record_Id__c.startsWith(ApexUtil.getKeyPrefix('Callout_Data_Item__c'))) {
                    log.Callout_Data_Item__c = event.Record_Id__c;
                } else if (event.Record_Id__c.startsWith(ApexUtil.getKeyPrefix('Account'))) {
                    log.Account__c = event.Record_Id__c;
                } else if (event.Record_Id__c.startsWith(ApexUtil.getKeyPrefix('Callout_Data__c'))) {
                    log.Callout_Data__c = event.Record_Id__c;
                } else if (event.Record_Id__c.startsWith(ApexUtil.getKeyPrefix('LegacyCRMLead__c'))) {
                    log.Legacy_CRM_Lead__c = event.Record_Id__c;
                } else if (event.Record_Id__c.startsWith(ApexUtil.getKeyPrefix('LegacyCRMNote__c'))) {
                    log.Legacy_CRM_Note__c = event.Record_Id__c;
                } else if (event.Record_Id__c.startsWith(ApexUtil.getKeyPrefix('LegacyCRMDebtDetail__c'))) {
                    log.Legacy_CRM_Debt_Detail__c = event.Record_Id__c;
                } else if (event.Record_Id__c.startsWith(ApexUtil.getKeyPrefix('Draft__c'))) {
                    log.Draft__c = event.Record_Id__c;
                } else if (event.Record_Id__c.startsWith(ApexUtil.getKeyPrefix('Campaign'))) {
                    log.Campaign__c = event.Record_Id__c;
                } else if (event.Record_Id__c.startsWith(ApexUtil.getKeyPrefix('Opportunity'))) {
                    log.Opportunity__c = event.Record_Id__c; //Added Opportunity
                }
            }
            applicationLogs.add(log); 
        }
        insert applicationLogs; 
    }
}