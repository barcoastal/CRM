public inherited sharing class DebitScheduleService {
    
    public static void createDebitSchedule(Set<Id> programPlanIdSet) {

        Map<Id, Map<Decimal, Debit_Schedule__c>> programPlanDebitScheduleMap = new Map<Id, Map<Decimal, Debit_Schedule__c>>();
        List<Debit_Schedule__c> debitScheduleToDelete = new List<Debit_Schedule__c>();
        List<Debit_Schedule__c> debitScheduleToUpsert = new List<Debit_Schedule__c>();
        
        if (!programPlanIdSet.isEmpty()) {

            //retrieving the current and existing draft records for the collected set of program plan records.
            for (Draft__c draft : DraftData.queryDraftswithOpenOpportunity(programPlanIdSet)) {
                if (!programPlanDebitScheduleMap.containsKey(draft.Program_Plan__c)) {
                    //forming the map to collect the set of program plans
                    programPlanDebitScheduleMap.put(draft.Program_Plan__c, new Map<Decimal, Debit_Schedule__c>());
                }
                if (!programPlanDebitScheduleMap.get(draft.Program_Plan__c).containsKey(draft.Draft_Total_Amount__c )) {
                    //forming a map of unique draft amount with debit schedule instance with number of payments as 1
                    programPlanDebitScheduleMap.get(draft.Program_Plan__c).put(
                        draft.Draft_Total_Amount__c , 
                        new Debit_Schedule__c(
                            Program_Plan__c = draft.Program_Plan__c, Deposit_Amount__c = draft.Draft_Total_Amount__c , 
                            Start_Date__c = draft.Draft_Date__c, Number_of_Payments__c = 1
                        )
                    );
                } else {
                    //updating the map by incrementing the count of the number of payments with same draft amount
                    programPlanDebitScheduleMap.get(draft.Program_Plan__c).get(draft.Draft_Total_Amount__c ).Number_of_Payments__c++;
                }
            }
            
            //retrieving the debit schedule records for the collected set of progrma plan records
            for (Debit_Schedule__c debit : DebitScheduleData.queryDebitSchedules(programPlanDebitScheduleMap.keySet())) {
                if (programPlanDebitScheduleMap.get(debit.Program_Plan__c).containsKey(debit.Deposit_Amount__c)) {
                    //updating the map by adding the debit schedule id if debit schedule record with same draft amount already exists
                    programPlanDebitScheduleMap.get(debit.Program_Plan__c).get(debit.Deposit_Amount__c).Id = debit.Id;
                } else {
                    //adding the debit schedule record to delete list if the draft amount doesn't exists in the current payment schedule
                    debitScheduleToDelete.add(debit);
                }
            }
			
            for (Id programPlanId : programPlanDebitScheduleMap.keySet()) {
                //assigning all the debit schedule records to a list to upsert
                debitScheduleToUpsert.addAll(programPlanDebitScheduleMap.get(programPlanId).values());
            }
        }

        if (!debitScheduleToDelete.isEmpty()) {
            delete debitScheduleToDelete;
        }

        if (!debitScheduleToUpsert.isEmpty()) {
            upsert debitScheduleToUpsert;
        }
    }
}