public with sharing class AsyncOpUpdateAdClickId implements IAsyncOperation {

     public static void execute(Map<String, Object> inputMap, Map<String, Object> outputMap) {
        try {
            if (inputMap != null && !inputMap.isEmpty() && inputMap.containsKey('asyncOperationRecords')) {
                List<Async_Operation__c> asyncOperationRecords = (List<Async_Operation__c>)inputMap.get('asyncOperationRecords');
                if (asyncOperationRecords != null && !asyncOperationRecords.isEmpty()) {
                    processOperations(asyncOperationRecords);
                }
            }
        } catch(Exception ex) {
            ApplicationLogger.logException(ex, null);
        } finally {
            ApplicationLogger.insertStoredLogs();
        }
    }

    // Wrapper to structure the incoming JSON payload safely
    public class leadDetials {
        public String leadSource;
    }

    public static void processOperations(List<Async_Operation__c> operations) {
        
        Map<String, Async_Operation_Retry_Config__mdt> configMap = getConfigs();
        Map<Id, Async_Operation__c> opMap = new Map<Id, Async_Operation__c>(); 
        List<Lead> leadsToUpdate = new List<Lead>();

        Set<String> phoneNumbers = new Set<String>();
        Map<Id, String> opToLeadSourceMap = new Map<Id, String>(); 
        for (Async_Operation__c op : operations) {
            try {
               if (String.isNotBlank(op.Customer_Phone_Number__c)) {
                    phoneNumbers.add(op.Customer_Phone_Number__c);
                
                    opToLeadSourceMap.put(op.Id, op.lead_source__c);
                }
            } catch (Exception e) {
                op.Status__c = 'Failed';
                op.Message__c = e.getMessage();
            }
        }


        Map<String, Lead> leadMap = new Map<String, Lead>();
        for (Lead l : [SELECT Id, formated_Phone__c, LeadSource FROM Lead WHERE formated_Phone__c IN :phoneNumbers AND Lead_Source_Category__c = 'Web' AND LeadSource LIKE 'IB%' ORDER BY CreatedDate DESC]) {
            if(!leadMap.containsKey(generateKey(l.formated_Phone__c, l.LeadSource))){
               leadMap.put(generateKey(l.formated_Phone__c, l.LeadSource), l);
            }
        }

        for (Async_Operation__c op : operations) {
            String phone = op.Customer_Phone_Number__c;             
            String clickId = op.Ad_Click_Id_Text__c;     
            String source = opToLeadSourceMap.get(op.Id);

            Async_Operation_Retry_Config__mdt config = configMap.get(op.Operation__c);
            String key = generateKey(phone, source);
            if (leadMap.containsKey(key)) {
                Lead matchedLead = leadMap.get(key);
                matchedLead.Ad_Click_ID__c = clickId;
                leadsToUpdate.add(matchedLead);
                op.Record_Id__c = matchedLead.Id;
                op.Lead__c = matchedLead.Id;
                op.Status__c = 'Completed';
                op.Message__c = 'Success: Matched Lead ' + matchedLead.Id;
                leadMap.remove(key);
            } else {
                handleRetryUpdate(op, config);
            }
        }
        if (!leadsToUpdate.isEmpty() && !Test.isRunningTest()) {
            DMLService.performUpdateDML(leadsToUpdate,'AsyncOpUpdateAdClickId');
        }
        
        if (!operations.isEmpty()) {
            DMLService.performUpdateDML(operations,'AsyncOpUpdateAdClickId');
        }
    }

    private static void handleRetryUpdate(Async_Operation__c op, Async_Operation_Retry_Config__mdt config) {
        if (op.Retry_Attempts__c == null){
            op.Retry_Attempts__c = 0;
        } 
        
        op.Retry_Attempts__c = op.Retry_Attempts__c + 1;
        
        op.Last_Retry_Timestamp__c = System.now();

        if (op.Retry_Attempts__c >= config.Max_Retry_Count__c) {
            op.Status__c = 'Failed';
            op.Message__c = 'Max retries (' + config.Max_Retry_Count__c + ') reached. Lead not found.';
        } else {
            op.Status__c = 'Failed'; 
            op.Message__c = 'Attempt #' + op.Retry_Attempts__c + ' failed. Lead not found.';
        }
    }
 
    private static Map<String, Async_Operation_Retry_Config__mdt> getConfigs() {
        Map<String, Async_Operation_Retry_Config__mdt> m = new Map<String, Async_Operation_Retry_Config__mdt>();
        for (Async_Operation_Retry_Config__mdt c : [
            SELECT Async_Operation_Type__c, Max_Retry_Count__c, Retry_Interval_Hours__c, Is_Active__c 
            FROM Async_Operation_Retry_Config__mdt 
            WHERE Is_Active__c = TRUE
        ]) {
            m.put(c.Async_Operation_Type__c, c);
        }
        return m;
    }

    private static String generateKey(String phone, String source) {
        String p = (phone != null) ? phone : '';
        String s = (source != null) ? source : '';
        return p + '-' + s; 
    }
}