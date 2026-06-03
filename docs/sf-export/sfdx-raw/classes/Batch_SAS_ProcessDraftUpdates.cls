/*----------------------------------------------------------------
    Author: Vinitha
    Description: A batch to process staging records. It updates or inserts Draft records 
                 and populates fee fields directly on the Draft from child payment data.
    Test Class: Batch_SAS_ProcessDraftUpdatesTest
--------------------------------------------------------------------*/
public without sharing class Batch_SAS_ProcessDraftUpdates implements Database.Batchable<SObject> {
    
    public static Payment_Processor__c sasProcessor = getSASPaymentProcessor();
    public Id externalApiIdVar;
    public static final Integer SETUP_FEE_AND_CITADEL_FEE_PAYEE_ID = sasProcessor.Setup_Fee_Payee_Id__c != Null ? Integer.valueOf(sasProcessor.Setup_Fee_Payee_Id__c) : Null;     
    public String queryString;

    public Batch_SAS_ProcessDraftUpdates(Id externalApiId) {
        this.externalApiIdVar = externalApiId;
        this.queryString = 'SELECT Id, Client_SF_Id__c, Payment_Amount__c, Payment_Date__c, Payment_External_Id__c, NSF_Reason__c,Debit_Date_Cleared__c, ' +
                           'Payment_SF_Id__c, Payment_Status__c, Is_Child__c ,Client_External_Id__c ' +
                           'FROM External_Data__c WHERE External_API_Details__c =:externalApiIdVar AND Is_Child__c = FALSE';
    }
    
    public Batch_SAS_ProcessDraftUpdates(Id externalApiId,String query) {
        this.externalApiIdVar = externalApiId;
        this.queryString = query;
    }

    // Start method now queries all necessary fields, including the Is_Child__c flag
    public Database.QueryLocator start(Database.BatchableContext bc){
        return Database.getQueryLocator(queryString);
    }

    public void execute(Database.BatchableContext bc, List<External_Data__c> scope) {
        try {
            // --- 1. Segregate Parent and Child Data ---
            List<External_Data__c> parentData = scope;
            Set<String> parentSASIds = new Set<String>();
            Set<Id> parentAccountIds = New Set<Id>();
            Set<Id> existingDrafts = New Set<Id>();
            Set<String> newDraftsSASIds = New Set<String>();
            Map<String, List<External_Data__c>> childrenByParentExtId = new Map<String, List<External_Data__c>>();

            for (External_Data__c exData : parentData) {
              
                parentAccountIds.add(exData.Client_SF_Id__c);
                if(String.isNotBlank(exData.Payment_External_Id__c)){
                    parentSASIds.add(exData.Payment_External_Id__c);
                }
                if(String.isNotBlank(exData.Payment_SF_Id__c)){
                    existingDrafts.add(exData.Payment_SF_Id__c);
                } else if (String.isBlank(exData.Payment_SF_Id__c)){
                    newDraftsSASIds.add(exData.Payment_External_Id__c);
                }
            }
            
            if(!parentSASIds.isEmpty()){
                List<External_Data__c> childRecords = [
                    SELECT Id, Client_SF_Id__c, Payment_Amount__c, Payment_External_Id__c, Is_Child__c, Client_External_Id__c 
                    FROM External_Data__c 
                    WHERE External_API_Details__c = :externalApiIdVar 
                    AND Is_Child__c = TRUE 
                    AND Client_SF_Id__c IN :parentSASIds
                ];
                
                for(External_Data__c child : childRecords){
                    // Group children by the Parent's SAS ID (Payment_External_Id__c)
                    if (!childrenByParentExtId.containsKey(child.Client_SF_Id__c)) {
                        childrenByParentExtId.put(child.Client_SF_Id__c, new List<External_Data__c>());
                    }
                    childrenByParentExtId.get(child.Client_SF_Id__c).add(child);
                }
            }

            if (parentData.isEmpty()) {
                return; 
            }
            Map<Id, Program_Plan__c> accountIdToProgramPlan  = ProgramPlanData.getActiveProgramPlanOfAccount(parentAccountIds);
            Map<Id, Draft__c> draftsToUpdate = new Map<Id, Draft__c>(DraftData.queryDraftsByIds(existingDrafts));
            Map<String,Draft__c> draftsBySASId = DraftData.queryDraftsBySASIds(newDraftsSASIds);
            List<Draft__c> draftsToInsert = new List<Draft__c>();
            List<External_Data__c> externalDataToFail = new List<External_Data__c>();

            Map<String, String> statusMapping = getPaymentStatusMap();
            Map<Integer, String> payeeFieldMapping = getSASPayeesById(sasProcessor);
            
            // --- 3. Process Parent Records ---
            for (External_Data__c parent : parentData) {

                // Determine if it's an insert or update
                Boolean isUpdate = String.isNotBlank(parent.Payment_SF_Id__c);
                Boolean isUpdateBySASId = draftsBySASId.get(parent.Payment_External_Id__c) != null;
                Draft__c draftRecord;
                
                if(isUpdate){
                    draftRecord = draftsToUpdate.get(parent.Payment_SF_Id__c);
                }else if(isUpdateBySASId){
                   draftRecord = draftsBySASId.get(parent.Payment_External_Id__c);
                }else {
                   draftRecord = initializeNewDraft(parent, accountIdToProgramPlan);
                }
                         
                if (draftRecord == null) {
                    parent.Processing_Status__c = 'Failed';
                    parent.Error_Message__c = 'Data integrity error: No matching Draft record found for Payment_SF_Id__c ' + parent.Payment_SF_Id__c;
                    externalDataToFail.add(parent);
                                  
                    continue;
                }
                
                if(String.isNotBlank(parent.Payment_Date__c)){
                   draftRecord.Draft_Date__c = convertToDate(parent.Payment_Date__c);
                }
                if(String.isNotBlank(parent.Payment_Amount__c)){
                   draftRecord.Draft_Amount__c = Decimal.valueOf(parent.Payment_Amount__c);
                }
               
                String paymentStatus = parent.Payment_Status__c;
                if (statusMapping.containsKey(paymentStatus)) {
                    draftRecord.Draft_Status__c = statusMapping.get(paymentStatus);
                }
                
                if(String.isNotBlank(parent.NSF_Reason__c) && parent.Payment_Status__c == 'Failed'){
                   draftRecord.Bank_Account_Status__c = parent.NSF_Reason__c;
                }
  
    if (String.isNotBlank(parent.Debit_Date_Cleared__c)) {
                   draftRecord.Draft_Cleared_Date__c = convertToDate(parent.Debit_Date_Cleared__c);
                }
                
                if (childrenByParentExtId.containsKey(parent.Payment_External_Id__c)) {
                    Program_Plan__c relatedPlan = accountIdToProgramPlan.get(parent.Client_SF_Id__c);
                    Decimal setupFeeFromPlan = (relatedPlan != null && relatedPlan.Setup_fee__c != null) ? Decimal.valueOf(relatedPlan.Setup_fee__c) : 0;

                    for (External_Data__c child : childrenByParentExtId.get(parent.Payment_External_Id__c)) {
                        Integer payeeId = Integer.valueOf(child.Client_External_Id__c);
                        Decimal feeAmount = Decimal.valueOf(child.Payment_Amount__c);

                        // Find the corresponding Draft field name from the mapping
                        if (payeeFieldMapping.containsKey(payeeId)) {
                            String draftFieldName = payeeFieldMapping.get(payeeId);
                            if(payeeId == SETUP_FEE_AND_CITADEL_FEE_PAYEE_ID && setupFeeFromPlan == feeAmount){
                              draftRecord.put(DraftUtil.SETUP_FEE_FIELD,feeAmount);
                            } else {
                              draftRecord.put(draftFieldName, feeAmount);
                            }
                            draftRecord.Draft_Amount__c = draftRecord.Draft_Amount__c - feeAmount;
                        }
                    }
                }
                Decimal processorFee = draftRecord.Processor_Fee__c != null ? draftRecord.Processor_Fee__c : 0;
                draftRecord.Draft_Amount__c = draftRecord.Draft_Amount__c - processorFee;
                draftRecord.External_Data__c = parent.Id;

                if (isUpdate || isUpdateBySASId) {
                    draftsToUpdate.put(draftRecord.Id, draftRecord);
                } else {
                    draftsToInsert.add(draftRecord);
                }
            }
            OpportunityLockService.disableOppLockForSystemUpdates();
            // --- 5. Perform DML ---
            if (!draftsToInsert.isEmpty()) {
                DraftTriggerHandler.bypassPopulateSyncPending = true;
                handleDML(Database.insert(draftsToInsert, false), draftsToInsert);
                DraftTriggerHandler.bypassPopulateSyncPending = false;
            }
            
            if (!draftsToUpdate.isEmpty()) {
                DraftTriggerHandler.bypassPopulateSyncPending = true;
                handleDML(Database.update(draftsToUpdate.values(), false), draftsToUpdate.values());
                DraftTriggerHandler.bypassPopulateSyncPending = false;
            }
            OpportunityLockService.reEnableOppLockAsSystemUpdatesDone();
            if (!externalDataToFail.isEmpty()) {
                update externalDataToFail;
            }
            ApplicationLogger.insertStoredLogs();
        } catch (Exception exp) {
            ApplicationLogger.logException(exp, this.externalApiIdVar);
        }
    }

    private Draft__c initializeNewDraft(External_Data__c parent, Map<Id, Program_Plan__c> plansByAccountId){
        Program_Plan__c plan = plansByAccountId.get(parent.Client_SF_Id__c);
        return new Draft__c(
            Program_Plan__c = (plan != null) ? plan.Id : null,
            External_SAS_Id__c = parent.Payment_External_Id__c,
            Program_Fee__c = 0,
            Processor_Fee__c = 0,
            Retainer_Fee__c = 0,
            Citadel_Fee__c = 0,
            Service_Fee__c = 0,
            Setup_Fee__c = 0,
            Draft_Date__c = null,
            Draft_Amount__c = null,
            Draft_Status__c = null
        );
    }
    
    public void finish(Database.BatchableContext bc) { 
        External_API_Details__c externalApi = new External_API_Details__c(
            Id = this.externalApiIdVar,
            API_Status__c = 'Completed'
        );
        Database.SaveResult srData = Database.update(externalApi , false);
        if (!srData.isSuccess()) {
            for (Database.Error err : srData.getErrors()) {
                ApplicationLogger.logDMLException('External API Details fields that affected this error : ' + String.join(err.getFields(), ', '), srData.getId(), err.getStatuscode() + ': ' + err.getMessage());
            }
        }
    }
    
    public Static Date convertToDate(String paymentDate){
        if(String.isBlank(paymentDate)){
          return null;  
        } 
        return Date.parse(paymentDate.split(' ')[0]);
    }

    private Map<String, String> getPaymentStatusMap() {
        Map<String, String> paymentStatusMapping = new Map<String, String>();
        for(SAS_Payment_Status_Mapping__mdt paymentMap :[SELECT SF_Draft_Status__c, SAS_Draft_Status__c FROM SAS_Payment_Status_Mapping__mdt WHERE SF_Draft_Status__c != null AND SAS_Draft_Status__c != null]){
            paymentStatusMapping.put(paymentMap.SAS_Draft_Status__c, paymentMap.SF_Draft_Status__c);
        }
        return paymentStatusMapping;
    }

    private void handleDML(List<Database.SaveResult> results, List<Draft__c> draftsList) {
        List<External_Data__c> externalDataUpdateList = new List<External_Data__c>();
        Integer count = 0;
        for (Database.SaveResult res : results) {
            External_Data__c externalDataUpdate = new External_Data__c();
            externalDataUpdate.Id = draftsList[count].External_Data__c;
            if (!res.isSuccess()) {
                String errorMessage = '';
                for (Database.Error err : res.getErrors()) {
                    errorMessage += err.getMessage() + '. ';
                }
                ApplicationLogger.logDMLException('Drafts insert/update failed', res.getId(), errorMessage, true);
                externalDataUpdate.Processing_Status__c = 'Failed';
                externalDataUpdate.Error_Message__c = errorMessage != null ? errorMessage.left(255) : 'Unknown error during Draft processing';
            } else {
                externalDataUpdate.Processing_Status__c = 'Success';
            }
            externalDataUpdateList.add(externalDataUpdate);
            count++;
        }
        try {
            update externalDataUpdateList;
        } catch(Exception ex) {
            ApplicationLogger.logException(ex, this.externalApiIdVar, 'External Data update failed after Drafts DML operation.', ApplicationLogger.SEVERITY_HIGH);
        }
    }

    private Map<Integer,String> getSASPayeesById(Payment_Processor__c sasProcessor){
        Map<Integer,String> payeesById = new Map<Integer,String>();
        try {            
            payeesById.put(Integer.valueOf(sasProcessor.Program_Fee_Payee_Id__c),DraftUtil.PROGRAM_FEE_FIELD);
            payeesById.put(Integer.valueOf(sasProcessor.Citadel_Fee_Payee_Id__c),DraftUtil.CITADEL_FEE_FIELD); 
            payeesById.put(Integer.valueOf(sasProcessor.Service_Fee_Payee_Id__c),DraftUtil.SERVICE_FEE_FIELD); 
            payeesById.put(Integer.valueOf(sasProcessor.Retainer_Fee_Payee_Id__c),DraftUtil.RETAINER_FEE_FIELD);
        } catch (Exception e) {
            ApplicationLogger.logException(e, this.externalApiIdVar);
        }
        return payeesById;
    }
    
    public static Payment_Processor__c getSASPaymentProcessor(){
       Payment_Processor__c sasProcessor = PaymentProcessorData.querySASPaymentProceesor();
        return sasProcessor;
    }
    
    
}