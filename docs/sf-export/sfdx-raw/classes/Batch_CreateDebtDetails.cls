/**
 * Description: Batch class to create debt details record from the legacy CRM database 
 * based on debtDetails records and the records created from the predecessor batch.
 */
public with sharing class Batch_CreateDebtDetails implements Database.Batchable<AggregateResult> {

    /**
     * Start method to query the debtDetail records grouped by the legacy CRM Lead Id.
     * Used grouping to create all the debt details for the specific lead or account in a single execution.
     */ 
    public Iterable<AggregateResult> start(Database.BatchableContext BC) {
        return [SELECT Deal_Id__c Id, COUNT(Id) LeadCount FROM LegacyCRMDebtDetail__c GROUP BY Deal_Id__c];
    }

    /**
     * Execute method to create debt details from the legacy CRM.
     * If the legacy CRM Id is available in Lead, the debt details are added in the lead fields,
     * else the debt details are created as a new record and relate it to program plan and opporutnity.
     */
    public void execute(Database.BatchableContext BC, List<AggregateResult> scope) {
		
        // Map of legacy CRM Id with aggregate result to retrieve the set of legacy CRM Id.
        Map<Id, AggregateResult> aggResultMap = new Map<Id, AggregateResult>(scope);
        // Map of legacy CRM Id with the Count, to get the count of debt details added in the lead fields.
        Map<String, Integer> crmIdWithCounter = new Map<String, Integer>();
        Map<String, Program_Plan__c> programPlanMap = new Map<String, Program_Plan__c>();
        Map<String, Id> crmIdWithLeadId = new Map<String, Id>();
        Map<Id, Lead> leadToUpdateMap = new Map<Id, Lead>();
        List<Debt_Details__c> debtDetailList = new List<Debt_Details__c>();
        List<LegacyCRMDebtDetail__c> crmDebtDetailToUpdate = new List<LegacyCRMDebtDetail__c>();
        List<String> crmDebtDetailId = new List<String>();
        List<String> crmLeadId = new List<String>();
        
        // query to get the salesforce lead which is created from the legacy crm data.
        for (Lead leadInstance : [SELECT Id, External_Legacy_CRM_Id__c FROM Lead WHERE External_Legacy_CRM_Id__c IN :aggResultMap.keySet()]) {
            crmIdWithLeadId.put(leadInstance.External_Legacy_CRM_Id__c, leadInstance.Id);
        }
        
        // query to get the program plan which is created from the legacy crm data.
        for (Program_Plan__c programPlan : [
            SELECT Id, Opportunity__c, Total_Debt__c, External_Legacy_CRM_Id__c FROM Program_Plan__c 
            WHERE External_Legacy_CRM_Id__c IN :aggResultMap.keySet()
        ]) {
            programPlanMap.put(programPlan.External_Legacy_CRM_Id__c, programPlan);
        }

        List<LegacyCRMDebtDetail__c> crmDebtDetails = [
            SELECT Id, Name, Deal_Id__c, Lender_Name__c, Amount_Owed__c, Payment_Amount__c, Frequency__c, Lender_Id__c  
            FROM LegacyCRMDebtDetail__c WHERE Deal_Id__c IN :aggResultMap.keySet()
        ];
        
        for (LegacyCRMDebtDetail__c debtDetail : crmDebtDetails) {

            Debt_Details__c newDebtDetail = new Debt_Details__c();

            if (!programPlanMap.isEmpty() && programPlanMap.containsKey(debtDetail.Deal_Id__c)) {
                Program_Plan__c programPlan = programPlanMap.get(debtDetail.Deal_Id__c);
                newDebtDetail.Creditor_Name__c = debtDetail.Lender_Name__c;
                newDebtDetail.Debt_Amount__c = debtDetail.Amount_Owed__c;
                newDebtDetail.Payment__c = debtDetail.Payment_Amount__c;
                newDebtDetail.Payment_Frequency__c = debtDetail.Frequency__c;
                newDebtDetail.Program_Plan__c = programPlan.Id;
                newDebtDetail.Opportunity__c = programPlan.Opportunity__c;
                newDebtDetail.External_Legacy_CRM_Id__c = debtDetail.Lender_Id__c;
                debtDetailList.add(newDebtDetail);
                crmDebtDetailId.add(debtDetail.Id);
            } else if (!crmIdWithLeadId.isEmpty() && crmIdWithLeadId.containsKey(debtDetail.Deal_Id__c)) {
                Id leadId = crmIdWithLeadId.get(debtDetail.Deal_Id__c);
                Lead leadInstance = leadToUpdateMap.containsKey(leadId) ? leadToUpdateMap.get(leadId) : new Lead(Id = leadId);
                Integer counter = crmIdWithCounter.containsKey(debtDetail.Deal_Id__c) ? crmIdWithCounter.get(debtDetail.Deal_Id__c) : 1;
                // condition check to make sure the debt details count for a lead doesn't exists as we have only 10 set of debt information field in lead.
                if (counter < 10) {
                    leadInstance.put('External_Legacy_CRM_Id__c', debtDetail.Deal_Id__c);
                    leadInstance.put('External_Legacy_CRM_Lender_Id__c', debtDetail.Lender_Id__c);
                    leadInstance.put('Creditor_'+counter+'_Name__c', debtDetail.Lender_Name__c);
                    leadInstance.put('Creditor_'+counter+'_Total_Debt__c', debtDetail.Amount_Owed__c);
                    leadInstance.put('Creditor_'+counter+'_Payment__c', debtDetail.Payment_Amount__c);
                    leadInstance.put('Creditor_'+counter+'_Payment_Frequency__c', debtDetail.Frequency__c);
                    leadToUpdateMap.put(leadId, leadInstance);
                    crmIdWithCounter.put(debtDetail.Deal_Id__c, counter+1);
                    crmLeadId.add(debtDetail.Id);
                }
            }
        }

        if (!debtDetailList.isEmpty()) {
            Integer i = 0;
            //Upsert all the debt detail records from legacy CRM based on the external lead Id.
            for (Database.UpsertResult urDebtDetails : Database.upsert(debtDetailList, Debt_Details__c.Fields.External_Legacy_CRM_Id__c, false)) {
                if (urDebtDetails.isSuccess()) {          
                    LegacyCRMDebtDetail__c crmDebtDetail = new LegacyCRMDebtDetail__c();
                    crmDebtDetail.Id = crmDebtDetailId[i];
                    crmDebtDetail.Converted_to_Debt_Detail__c = true;
                    crmDebtDetailToUpdate.add(crmDebtDetail);
                } else {
                    String errorMessage = '';
                    for (Database.Error err : urDebtDetails.getErrors()) {
                        errorMessage += err.getMessage() + '. ';
                    }
                    ApplicationLogger.logDMLException('Conversion from Legacy CRM DebtDetail to Debt Details is failed', crmDebtDetailId[i],  errorMessage, true);
                }
                i++;
            }
        }

        if (!leadToUpdateMap.values().isEmpty()) {
            Integer k = 0;
            //Upsert all the lead records with debt details from legacy CRM based on the external lead Id.
            for (Database.UpsertResult urLead : Database.upsert(leadToUpdateMap.values(), Lead.Fields.External_Legacy_CRM_Id__c, false)) {
                if (urLead.isSuccess()) {          
                    LegacyCRMDebtDetail__c crmDebtDetail = new LegacyCRMDebtDetail__c();
                    crmDebtDetail.Id = crmLeadId[k];
                    crmDebtDetail.Converted_to_Lead__c = true;
                    crmDebtDetailToUpdate.add(crmDebtDetail);
                } else {
                    String errorMessage = '';
                    for (Database.Error err : urLead.getErrors()) {
                        errorMessage += err.getMessage() + '. ';
                    }
                    ApplicationLogger.logDMLException('Conversion from Legacy CRM DebtDetail to Lead is failed', crmLeadId[k], errorMessage, true);
                }
                k++;
            }
        }
        
        if (!crmDebtDetailToUpdate.isEmpty()) {
            Integer j = 0;
            for (Database.SaveResult saveResult : Database.update(crmDebtDetailToUpdate, false)) {
                if (!saveResult.isSuccess()) {
                    String errorMessage;
                    for (Database.Error err : saveResult.getErrors()) {
                        errorMessage += err.getMessage() + '. ';
                    }
                    ApplicationLogger.logDMLException('Updating Legacy Lead Note with Converted_To_DebtDetail__c true is failed', crmDebtDetailToUpdate[j].Id, errorMessage, true);
                }
                j++;
            }
        }
        ApplicationLogger.insertStoredLogs();
    }

    public void finish(Database.BatchableContext BC) {
        // execute the successor batch to create dispositions from the legacy crm data.
		Database.executeBatch(new Batch_CreateActivities());
    }
}