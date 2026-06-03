public inherited sharing class LeadConversionHandler extends TriggerHandler{

    public static void postLeadConversion() {
        Map<Id, Program_Plan__c> leadIdWithProgramPlansToInsert = new Map<Id, Program_Plan__c>();
        List<Account> accountsToUpdate = new List<Account>();
        List<Contact> contactsToUpdate = new List<Contact>();
        List<Opportunity> opportunitiesToUpdate = new List<Opportunity>();
        // List<Payment_Processor__c> paymentProcessors = PaymentProcessorData.queryPaymentProcessorRecord();
        List<OpportunityLineItem> oppLineItemsToUpdateList = new List<OpportunityLineItem>();
        PricebookEntry citadelPriceBookEntry = ProductAndPriceBookUtil.getPriceBookEntry(ProductAndPriceBookUtil.PRICE_BOOK_SAS, ProductAndPriceBookUtil.PRODUCT_CITADEL_FEE);
        PricebookEntry victoryPriceBookEntry = ProductAndPriceBookUtil.getPriceBookEntry(ProductAndPriceBookUtil.PRICE_BOOK_SAS, ProductAndPriceBookUtil.PRODUCT_VICTORY_FEE);
        //Taken default to CITADEL legal plan setup fee
        Decimal legalPlanSetupFee = SetupFeeMappingData.getSetupFee(FileUtil.CITADEL_LEGAL_PLAN, true);
        set<String> paymentProcessorStates = new Set<String>();
        for (Lead leadInstance : (List<Lead>)Trigger.new) {
            Lead oldLeadInstance = (Lead)Trigger.oldMap.get(leadInstance.Id);
            if (leadInstance.IsConverted != oldLeadInstance.IsConverted) {
                if (leadInstance.convertedOpportunityId != null) {
                    Opportunity oppToUpdate = new Opportunity();
                    oppToUpdate.Id = leadInstance.ConvertedOpportunityId;
                    oppToUpdate.Name = String.isNotBlank(leadInstance.FirstName) ? leadInstance.FirstName + ' ' + leadInstance.LastName : leadInstance.LastName;
                    oppToUpdate.Phone__c = leadInstance.Phone;
                    oppToUpdate.Email__c = leadInstance.Email;
                    //Added logic for copying the AdClickId to opp level
                    oppToUpdate.Ad_Click_Id__c = leadInstance.Ad_Click_Id__c;
                    //DocuSign Fields
                    oppToUpdate.DS_Payment_Term__c = leadInstance.Payment_Term__c;
                    oppToUpdate.DS_Payment_Frequency__c = leadInstance.Frequency__c;
                    oppToUpdate.DS_Program_Fee_Percentage__c = Decimal.valueOf(leadInstance.Program_Fee_Percentage__c);
                    oppToUpdate.DS_Retainer_Percentage__c = Decimal.valueOf(leadInstance.Retainer_Percentage__c);
                    oppToUpdate.DS_Settlement_Percentage__c = Decimal.valueOf(leadInstance.Settlement_Percentage__c);
                    oppToUpdate.Legal_Plan_Required__c = leadInstance.Setup_Fee__c == String.valueOf(legalPlanSetupFee.intValue());
                    oppToUpdate.Version__c = 1;
                    opportunitiesToUpdate.add(oppToUpdate);

                    if (citadelPriceBookEntry != null) {
                        OpportunityLineItem oppLineItemToUpdate = new OpportunityLineItem();
                        oppLineItemToUpdate.OpportunityId = oppToUpdate.Id;
                        oppLineItemToUpdate.Product2Id = citadelPriceBookEntry.Product2Id;
                        oppLineItemToUpdate.PricebookEntryId = citadelPriceBookEntry.Id;
                        oppLineItemToUpdate.Quantity = ProductAndPriceBookUtil.PRODUCT_QUANTITY;
                        oppLineItemToUpdate.TotalPrice = citadelPriceBookEntry.UnitPrice * oppLineItemToUpdate.Quantity;
                        oppLineItemsToUpdateList.add(oppLineItemToUpdate);
                    }
                    if (victoryPriceBookEntry != null) {
                        OpportunityLineItem victoryLineItem = new OpportunityLineItem();
                        victoryLineItem.OpportunityId = oppToUpdate.Id;
                        victoryLineItem.Product2Id = victoryPriceBookEntry.Product2Id;
                        victoryLineItem.PricebookEntryId = victoryPriceBookEntry.Id;
                        victoryLineItem.Quantity = ProductAndPriceBookUtil.PRODUCT_QUANTITY;
                        victoryLineItem.TotalPrice = victoryPriceBookEntry.UnitPrice * victoryLineItem.Quantity;
                        oppLineItemsToUpdateList.add(victoryLineItem);
                    }
                    if (leadInstance.State != null && leadInstance.State != '') {
                        paymentProcessorStates.add(leadInstance.State);
                    }
                    leadIdWithProgramPlansToInsert.put(leadInstance.Id, createProgramPlanInstance(leadInstance));
                }
                if (leadInstance.convertedAccountId != null) {
                    Account accountToUpdate = new Account();
                    accountToUpdate.Id = leadInstance.ConvertedAccountId;
                    accountToUpdate.SSN__c = leadInstance.SSN__c;
                    accountToUpdate.Primary_Contact__c = leadInstance.ConvertedContactId;
                    accountToUpdate.Lead_Created_Date__c = leadInstance.CreatedDate;
                    accountsToUpdate.add(accountToUpdate);
                }
                if (leadInstance.ConvertedContactId != null) {
                    Contact contactToUpdate = new Contact();
                    contactToUpdate.Id = leadInstance.ConvertedContactId;
                    contactToUpdate.SSN_Encrypted__c = leadInstance.SSN__c;
                    contactToUpdate.Birthdate = leadInstance.Date_Of_Birth__c;
                    contactsToUpdate.add(contactToUpdate);
                }
            }
        }
        if (leadIdWithProgramPlansToInsert != null && !leadIdWithProgramPlansToInsert.values().isEmpty()) {

            Map<String, Id>  statePaymentProcessorMap = PaymentProcessorSvc.getEligiblePaymentProcessorId(paymentProcessorStates);
            for (ID thisLeadId : leadIdWithProgramPlansToInsert.keySet()) {
                Program_Plan__c thisProgramPlan = leadIdWithProgramPlansToInsert.get(thisLeadId);
                Lead thisLead = (Lead)Trigger.newMap.get(thisLeadId);
                if (thisLead.State != null) {
                    thisProgramPlan.Payment_Processor__c = statePaymentProcessorMap.get(thisLead.State.toUpperCase());
                } else {
                    thisProgramPlan.Payment_Processor__c = statePaymentProcessorMap.get('DEFAULT');
                }
            }

            // Insert Program_Plan__c records
            insert leadIdWithProgramPlansToInsert.values();
            createDebtDetails(leadIdWithProgramPlansToInsert);
        }
        if (!accountsToUpdate.isEmpty()) {
            update accountsToUpdate;
        }
        if (!opportunitiesToUpdate.isEmpty()) {
            update opportunitiesToUpdate;
        }
        if (!contactsToUpdate.isEmpty()) {
            update contactsToUpdate;
        }
        if (!oppLineItemsToUpdateList.isEmpty()) {
            insert oppLineItemsToUpdateList;
        }
    }

    //Methed to remove leads from five9 list - CD-543
    public static void removeLeadsFromFive9() {

        List<Lead> leadToUpdateList = new List<Lead>();

        for (Lead leadInstance : (List<Lead>)Trigger.new) {
            Lead oldLeadInstance = (Lead)Trigger.oldMap.get(leadInstance.Id);
            if (leadInstance.IsConverted != oldLeadInstance.IsConverted && leadInstance.Five9_List_Id__c != null) {
                //Adding the five9 list Id in Delete from Five9 List field will remove the lead from the five9.
                leadToUpdateList.add(
                    new Lead(
                        Id = leadInstance.Id, Five9_List_Id__c = null, Archived_Date__c = Date.Today(),Is_Archived__c = True
                      //  Delete_from_f9list_id__c = leadInstance.Five9_List_Id__c
                    )
                );
            }
        }
        //Updating the leads with delete from five9 list Id.
        update leadToUpdateList;
    }
    
    private static void createDebtDetails(Map<Id, Program_Plan__c> leadIdWithProgramPlanMap) {
        List<Debt_Details__c> debtDetialsToInsert = new List<Debt_Details__c>();
         // Collect Opportunity Ids from Program Plans
        Set<Id> opportunityIds = new Set<Id>();
        for (Program_Plan__c programPlan : leadIdWithProgramPlanMap.values()) {
            opportunityIds.add(programPlan.Opportunity__c);
        }
        // Query Opportunities to fetch related AccountIds
        Map<Id, Opportunity> opportunityMap = OpportunityData.getOppIdMap(opportunityIds);
        for (Id leadId : leadIdWithProgramPlanMap.keySet()) {
            Lead leadInstance = (Lead)Trigger.newMap.get(leadId);
            Program_Plan__c programPlan = leadIdWithProgramPlanMap.get(leadId);
            Opportunity relatedOpportunity = opportunityMap.get(programPlan.Opportunity__c);
            for (Integer ctr = 1; ctr <= 10; ctr++) {
                String creditorName = (String)leadInstance.get('Creditor_'+ctr+'_Name__c');
                String creditorId = (String)leadInstance.get('Creditor_'+ctr+'_Id__c');
                Decimal totalDebt = (Decimal)leadInstance.get('Creditor_'+ctr+'_Total_Debt__c');
                Decimal weeklyPayment = (Decimal)leadInstance.get('Creditor_'+ctr+'_Payment__c');
                String paymentFrequency = (String)leadInstance.get('Creditor_'+ctr+'_Payment_Frequency__c');
                String debtStatus = (String)leadInstance.get('Creditor_'+ctr+'_Debt_Status__c');
                if (totalDebt != null) {
                    Debt_Details__c debtInfo = new Debt_Details__c();
                    debtInfo.Opportunity__c = programPlan.Opportunity__c;
                    debtInfo.Program_Plan__c = programPlan.Id;
                    debtInfo.Creditor_Name__c = creditorName;
                    debtInfo.Current_Creditor__c = creditorId;
                    debtInfo.Debt_Amount__c = totalDebt;
                    debtInfo.Payment__c = weeklyPayment;
                    debtInfo.Payment_Frequency__c = paymentFrequency;
                    debtInfo.Debt_Status__c = debtStatus;
                     if (relatedOpportunity != null) {
                        debtInfo.Account__c = relatedOpportunity.AccountId;
                    }
                    debtDetialsToInsert.add(debtInfo);
                }
            }
        }
        if (!debtDetialsToInsert.isEmpty()) {
            insert debtDetialsToInsert;        }
    }

    private static Program_Plan__c createProgramPlanInstance(Lead leadInstance) {
        Program_Plan__c prgmPlan = new Program_Plan__c();
        prgmPlan.Opportunity__c = leadInstance.ConvertedOpportunityId;
        prgmPlan.Client__c = leadInstance.ConvertedAccountId;
        prgmPlan.Payment_Frequency__c = leadInstance.Frequency__c;
        prgmPlan.Payment_Term__c = leadInstance.Payment_Term__c;
        prgmPlan.Setup_Fee__c = leadInstance.Setup_Fee__c;
        prgmPlan.Settlement_Percentage__c = leadInstance.Settlement_Percentage__c;
        prgmPlan.Retainer_Percentage__c = leadInstance.Retainer_Percentage__c;
        prgmPlan.Program_Fee_Percentage__c = leadInstance.Program_Fee_Percentage__c;
        prgmPlan.Total_Debt__c = leadInstance.Current_Total_Debt_Amount__c;
        prgmPlan.First_Payment_Date__c = System.today().addDays(2);
        return prgmPlan;
    }


}