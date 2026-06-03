/**
 * @Description: Class to process the functionality on Lead trigger which extends TriggerHandler.
 * @Method - calculateCurrentTotalWeeklyPayment: To calculate the sum of total weekly payment based on the creditor frequency and creditor payment.
 * @Method - createTaskOnStatusChange: To create a task record on change of the lead status.
 */
//Updated the class to without sharing since the trigger should run in system mode and the user's CRUD and FLS should not affect any of the operations.
public without sharing class LeadTriggerHandler extends TriggerHandler {
    
    //Static varible to prevent recursion
    public static Boolean byPassLeadTrigger = false;
    public static Boolean preventRecursion = false;
    //Static variable to prevent updating custom calculated fields
    public static Boolean preventUpdatingCustomCalculatedFields = true;
    //Static variable to prevent creating task if status is updated from disposition component.
    public static Boolean preventTaskCreationOnStatusChange = false;

    public static Boolean runPopulateArchivedDateAndIsArchivedCheckboxInAsync = false;

    private Map<Id, Lead> leadOldMap;

    public LeadTriggerHandler() {
        this.leadOldMap = (Map<Id, Lead>) Trigger.oldMap;
    }

    /**
     * @description: Method to execute logic in the before insert trigger event.
     */
    public override void beforeInsert() {

        List<Lead> newLeads = (List<Lead>)Trigger.new;

        Id webLeadRTId = LeadUtil.getRecordTypeId(LeadUtil.RT_WEB_LEAD);
        Id listLeadRTId = LeadUtil.getRecordTypeId(LeadUtil.RT_LIST_LEAD);

        Map<String, Id> categoryToRecordTypeIdMap = new Map<String, Id>{
            LeadUtil.LEAD_SOURCE_WEB => webLeadRTId,
            LeadUtil.LEAD_SOURCE_LIST => listLeadRTId
        };

        Map<Id, String> recordTypeIdToDeveloperName = new Map<Id, String>{
            webLeadRTId => LeadUtil.RT_WEB_LEAD,
            listLeadRTId => LeadUtil.RT_LIST_LEAD
        };
        
        for (Lead leadInstance : (List<Lead>)Trigger.new) {
            leadInstance.Is_Payment_Amount_Populated__c = validateCreditorPayments(leadInstance);
            if (
                leadInstance.Creditor_1_Payment__c != NULL || leadInstance.Creditor_2_Payment__c != NULL || leadInstance.Creditor_3_Payment__c != NULL
                || leadInstance.Creditor_4_Payment__c != NULL || leadInstance.Creditor_5_Payment__c != NULL || leadInstance.Creditor_6_Payment__c != NULL
                || leadInstance.Creditor_7_Payment__c != NULL || leadInstance.Creditor_8_Payment__c != NULL || leadInstance.Creditor_9_Payment__c != NULL
                || leadInstance.Creditor_10_Payment__c != NULL
            ) {
                //method call to calculate the total weekly payment based on the creditor payment
                calculateCurrentTotalWeeklyPayment(leadInstance);
            }
           
        }
        ValidateAndPopulateRecordTypeId(newLeads, categoryToRecordTypeIdMap, recordTypeIdToDeveloperName);
        LeadAfterTriggerHelper.populateArchivedDateAndIsArchivedCheckbox();
    }
    
    public static Boolean validateCreditorPayments(Lead lead) {                   

            for (Integer i = 1; i <= 10; i++) {
                String totalDebtField = 'Creditor_' + i + '_Total_Debt__c';
                String paymentField = 'Creditor_' + i + '_Payment__c';  
                Decimal totalDebt = (Decimal)lead.get(totalDebtField);
                Decimal payment = (Decimal)lead.get(paymentField);
                if (totalDebt != null && payment != null && payment <= 0) {
                    return false;
                }
            }
     return true;
    }

    /**
     * @description: Method to execute logic in the before update trigger event.
     */
    public override void beforeUpdate() {
        for (Lead leadInstance : (List<Lead>)Trigger.new) {
            //Assign last dispostion based on the status change
            if (leadInstance.Status != this.leadOldMap.get(leadInstance.Id).Status) {
                leadInstance.Last_Disposition__c = this.leadOldMap.get(leadInstance.Id).Status;
                leadInstance.Last_Disposition_DateTime__c = System.now();
            }
            leadInstance.Is_Payment_Amount_Populated__c = validateCreditorPayments(leadInstance);
            //Assign last sub dispostion based on the sub disposition change
            if (leadInstance.Sub_Disposition__c != this.leadOldMap.get(leadInstance.Id).Sub_Disposition__c) {
                leadInstance.Last_Sub_Disposition__c = this.leadOldMap.get(leadInstance.Id).Sub_Disposition__c;
                leadInstance.Last_Disposition_DateTime__c = System.now();
            }
            //method call to check if there is a payment or frequency change in lead
            if (hasPaymentOrFrequencyChanged(leadInstance, this.leadOldMap.get(leadInstance.Id))) {
                //method call to calculate the total weekly payment based on the creditor payment
                calculateCurrentTotalWeeklyPayment(leadInstance);
            }

            //Lead should not be converted If lead's billing state falls in no business state.
            if (leadInstance.IsConverted && leadInstance.IsConverted != this.leadOldMap.get(leadInstance.Id).IsConverted && StateCodeUtil.isNoBusinessState(leadInstance.State)) {
                leadInstance.addError(System.Label.No_Business_State_Validation);
            }

            if (leadInstance.OwnerId != this.leadOldMap.get(leadInstance.Id).OwnerId) {
                // Adding the lead to make a filtered lead list
                leadInstance.Lead_Assignment_Date__c = Date.Today();
            }
        }
        LeadAfterTriggerHelper.populateArchivedDateAndIsArchivedCheckbox();
        LeadAfterTriggerHelper.archiveLeadsBasedOnDisposition((List<Lead>)Trigger.new, (Map<Id, Lead>)Trigger.oldMap);
    }
    
    /**
     * @description: Method to execute logic in the after insert trigger event.
     */
    public override void afterInsert() {
        Set<Id> recordIds = new Set<Id>();
        for (Lead leadRecord : (List<Lead>)Trigger.new) {
            if(leadRecord.Phone != null) {
                recordIds.add(leadRecord.Id);
            }
        }
        if(!Test.isRunningTest() && recordIds.size()>0 ) {
            OutboundAniHandler.performCallout(recordIds);
        }
        LeadAfterTriggerHelper.deduplicateWebLeadsAndUpdateFive9DNC();
        LeadAfterTriggerHelper.removeActiveLeadFormIndividual();
        LeadAfterTriggerHelper.createAsyncRecordsForArchivedLeads();
        LeadAfterTriggerHelper.createIndividualRecords();
        LeadAfterTriggerHelper.subDispoRequiredForArchivedLeads();
       /* try{
            Map<Lead,Individual> leadToIndividualMap = LeadAfterTriggerHelper.createIndividualRecords();
            
            HandleCreateIndividualResponse response = constructLeadIndividualMapping(leadToIndividualMap);
            LeadLifeCycleHandler.handleLeadLifeCycle(response.newLeadsMap,response.leadIdToIndividualMap,response.leadToActiveLeadMap);
        }catch(Exception ex){
            ApplicationLogger.logExceptionWithData(ex, null, null, ApplicationLogger.SEVERITY_HIGH);
        }*/
        //Invoking the service for creating async operation records
        LeadAfterTriggerAsyncOperationHelper.createAsyncOperationRecords();
    }

  /*  private static HandleCreateIndividualResponse constructLeadIndividualMapping(Map<Lead,Individual> leadToIndividualMap){
         HandleCreateIndividualResponse response = new HandleCreateIndividualResponse();
        Map<Id,Individual> leadIdToIndividualMap = new Map<Id,Individual>();
        Map<Id,Lead> leadToActiveLeadMap = new Map<Id,Lead>();
        Map<Id,Lead> newLeadsMap = new Map<Id,Lead>();
        Set<Id> activeLeadIds = new Set<Id>();
        List<lead> newLeadsList = New List<Lead>();
        for(Lead leadInst : leadToIndividualMap.keySet()){
            leadIdToIndividualMap.put(leadInst.Id,leadToIndividualMap.get(leadInst));
        }
        newLeadsList.addAll(leadToIndividualMap.keySet());
        //have to change this query parameter to leadIds
        Map<Id,lead> newLeads = LeadData.queryActiveleadOfIndividuals(leadIdToIndividualMap.KeySet());
        for(Lead leadRecord : newLeads.Values()){
         //   leadIdToIndividualMap.put(leadRecord.Id,leadToIndividualMap.get(leadRecord));
            newLeadsMap.put(leadRecord.Id,leadRecord);
            activeLeadIds.add(leadIdToIndividualMap.get(leadRecord.Id).Active_Lead__c);
        }
        leadToActiveLeadMap = getLeadIdToActiveLeadMap(activeLeadIds,leadToIndividualMap);
        response.leadToActiveLeadMap = leadToActiveLeadMap;
        response.newLeadsMap = newLeadsMap;
        response.leadIdToIndividualMap = leadIdToIndividualMap;
        return response;
    }
         
    public class HandleCreateIndividualResponse {
        public Map<Id,Lead> leadToActiveLeadMap;
        public Map<Id,Lead> newLeadsMap;
        public Map<Id,Individual> leadIdToIndividualMap;
    }
    
    private static Map<Id,Lead> getLeadIdToActiveLeadMap(Set<Id> activeLeadIds,Map<Lead,Individual> leadToIndividualMap){
        Map<Id,lead> individaulToLeadMap = new Map<Id,Lead>();
        Map<Id,Lead> leadToActiveLeadMap = new Map<Id,Lead>();
        Map<Id,Lead> leadList = LeadData.queryActiveleadOfIndividuals(activeLeadIds);
        
        for(Individual individualInstance : leadToIndividualMap.values()){
            individaulToLeadMap.put(individualInstance.Id,leadList.get(individualInstance.Active_Lead__c));
        }

        for(Lead leadInstance : leadToIndividualMap.KeySet()){
            leadToActiveLeadMap.put(leadInstance.Id,individaulToLeadMap.get(leadInstance.individualId));
        }
        return leadToActiveLeadMap;
    }*/

    /**
     * @description: Method to execute logic in the after update trigger event.
     */
    public override void afterUpdate() {
        List<Lead> statusChangedLeadList = new List<Lead>();
        for (Lead leadInstance : (List<Lead>)Trigger.new) {
            // Checking if the lead status is changed
            if (leadInstance.Status != this.leadOldMap.get(leadInstance.Id).Status) {
                // Adding the lead to make a filtered lead list
                statusChangedLeadList.add(leadInstance);
            }
        }
        
        if (!statusChangedLeadList.isEmpty()) {
            // Method call to create task record on change of the lead status
            createTaskOnStatusChange(statusChangedLeadList, this.leadOldMap);
        }

        // Class to handle the logic on lead conversion
        LeadConversionHandler.postLeadConversion();
        LeadAfterTriggerHelper.removeLeadsFromFive9();
        LeadAfterTriggerHelper.addNumbersToFive9DNC();
        //LeadAfterTriggerHelper.shareLeadToMCA();
        LeadAfterTriggerHelper.removeActiveLeadFormIndividual();
        LeadAfterTriggerHelper.createIndividualRecords();
        LeadAfterTriggerHelper.createAsyncRecordsForArchivedLeads();
        LeadAfterTriggerAsyncOperationHelper.createAsyncOperationRecords();
        LeadAfterTriggerHelper.subDispoRequiredForArchivedLeads();
        LeadAfterTriggerHelper.populateFronterDetailsInOpp();
    }

    public override void afterDelete() {
    }

    /**
     * @description: Method to calculate the Current Total Weekly Payment by aggregating all the creditor payment by converting it into a creditor weekly payment.
     * @param: leadInstance - The Lead record with the creditor values that needs to be caluculated.
     * @return Lead - The lead record with the calculated Currrent Total Payment.
     */
    public static Lead calculateCurrentTotalWeeklyPayment(Lead leadInstance) {
        Decimal currentTotalWeeklyPayment = 0;
        if (leadInstance != null) {
            for (Integer i=1; i<=10; i++) {
                if (leadInstance.get('Creditor_'+i+'_Payment__c') != null) {
                    Decimal creditorWeeklyPayment = (Decimal)leadInstance.get('Creditor_'+i+'_Payment__c');
                    if (leadInstance.get('Creditor_'+i+'_Payment_Frequency__c') != null) {
                        String creditorFrequency = (String)leadInstance.get('Creditor_'+i+'_Payment_Frequency__c');
                        if (creditorFrequency.equals('Daily')) {
                            creditorWeeklyPayment *= 5;
                        } else if (creditorFrequency.equals('Monthly')) {
                            creditorWeeklyPayment /= 4;
                        }
                    }
                    currentTotalWeeklyPayment += creditorWeeklyPayment;
                }
            }
            leadInstance.Current_Total_Weekly_Payment__c = currentTotalWeeklyPayment;
        }
        return leadInstance;
    }

    /**
     * @description: method to create task record if the lead status is changed
     * @param: filteredLeadList contains of lead which status are changed
     */
    private static void createTaskOnStatusChange(List<Lead> filteredLeadList, Map<Id, Lead> leadOldMap) {

        //Static variable to prevent creating task if lead status is updated from disposition component.
        if (!preventTaskCreationOnStatusChange) {
            List<Task> taskList = new List<Task>();
            Id dispositionRTId = ApexUtil.getRecordTypeIdbyDeveloperName('Task', 'Disposition');
            for (Lead leadInstance : filteredLeadList) {
                String oldLeadStatus = String.isNotBlank(leadOldMap.get(leadInstance.Id).Status) ? leadOldMap.get(leadInstance.Id).Status : '-None-';
                String newLeadStatus = String.isNotBlank(leadInstance.Status) ? leadInstance.Status : '-None-';
                Task taskInstance = new Task(
                    WhoId = leadInstance.Id,
                    Description = 'Lead Status changed from '+oldLeadStatus+' to '+newLeadStatus,
                    Status = 'Completed',
                    RecordTypeId = dispositionRTId,
                    Subject = 'Status Changed to '+newLeadStatus
                );
                taskList.add(taskInstance);
            }
            if (!taskList.isEmpty()) {
                insert taskList;
            }
        }
    }

    /**
     * @description: method to check there is a change in payment and payment frequency in the lead creditor fields
     * @param: newLead - Trigger.new, oldLead - Trigger.old
     * @return: return true if there is change else return false
     */
    private static Boolean hasPaymentOrFrequencyChanged(Lead newLead, Lead oldLead) {
        for (Integer i=1; i<=10; i++) {
            if (newLead.get('Creditor_'+i+'_Payment__c') != oldLead.get('Creditor_'+i+'_Payment__c') 
            || newLead.get('Creditor_'+i+'_Payment_Frequency__c') != oldLead.get('Creditor_'+i+'_Payment_Frequency__c')) {
                return true;
            }
        }
        return false;
    }

    private static void ValidateAndPopulateRecordTypeId(List<Lead> leads, Map<String,Id> categoryToRecordTypeIdMap, Map<Id,String> recordTypeIdToDeveloperName) {
        Id preLeadRTId = LeadUtil.getRecordTypeId(LeadUtil.RT_PRE_LEAD);
        for (Lead newLead : leads) {
            if (String.isNotBlank(newLead.Lead_Source_Category__c) && categoryToRecordTypeIdMap.containsKey(newLead.Lead_Source_Category__c) && newLead.recordTypeId != preLeadRTId) {
                Id targetRecordTypeId = categoryToRecordTypeIdMap.get(newLead.Lead_Source_Category__c);
                
                String oldRTName = recordTypeIdToDeveloperName.get(newLead.RecordTypeId);
                String newRTName = recordTypeIdToDeveloperName.get(targetRecordTypeId);

                if (newLead.RecordTypeId != targetRecordTypeId) {
                    newLead.RecordTypeId = targetRecordTypeId;
                    ApplicationLogger.logDetails('Assigning RecordType by Lead Source Category',newLead.Id,'From : ' + oldRTName + ' To : ' + newRTName);
                }
            }
        }
        ApplicationLogger.insertStoredLogs();
    }
}