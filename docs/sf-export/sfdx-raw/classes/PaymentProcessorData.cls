public inherited sharing class PaymentProcessorData {
    
    public static List<Payment_Processor__c> queryPaymentProcessorRecord() {
        return [SELECT Id FROM Payment_Processor__c ORDER BY CreatedDate DESC LIMIT 1];
    }

    /**
     * @description: Query then payment processor Id based on the processor type
    **/
    public static Id getPaymentProcId(String processorType) {
        String procId;
        List<Payment_Processor__c> processors = [SELECT Id FROM Payment_Processor__c WHERE Processor_Type__c = :processorType ORDER BY CreatedDate DESC LIMIT 1];
        if (processors != null && !processors.isEmpty()) {
            procId = processors[0].Id;
        } 
        return procId;
    }

    /**
     * @description: Query then payment processor Id based on the processor types
    **/
    public static Map<String, Id> getPaymentProcId(Set<String> processorTypes) {
        Map<String, Id> procTypeProcIdMap = new Map<String, Id>();
        for (Payment_Processor__c paymentProc : [SELECT Id, Processor_Type__c FROM Payment_Processor__c WHERE Processor_Type__c = :processorTypes ORDER BY CreatedDate DESC]) {
            procTypeProcIdMap.put(paymentProc.Processor_Type__c, paymentProc.Id);
        }
        return procTypeProcIdMap;
    }

    public static Payment_Processor__c queryPaymentProcessor(Id opportunityId) {
        List<Program_Plan__c> prgmPlans = [SELECT Id, Payment_Processor__c, Payment_Processor__r.Wire_Settlement_Fee__c
            FROM Program_Plan__c WHERE Opportunity__c = :opportunityId
        ];
        if (prgmPlans != null && !prgmPlans.isEmpty()) {
            return (Payment_Processor__c)prgmPlans[0].getSObject('Payment_Processor__r');
        }
        return null;
    }
    public static List<Payment_Processor__c> getPaymentProcessors() {
        return [
            SELECT Id, Name, Processor_Type__c, Monthly_Bank_Fee__c, Bank_Setup_Fee__c, Wire_Settlement_Fee__c, Default_Processor__c 
            FROM Payment_Processor__c 
        ];
    }
    
    public static Payment_Processor__c querySASPaymentProceesor(){
        return [SELECT Id,Program_Fee_Payee_Id__c,Citadel_Fee_Payee_Id__c,Setup_Fee_Payee_Id__c,Service_Fee_Payee_Id__c,Retainer_Fee_Payee_Id__c 
                 FROM Payment_Processor__c WHERE Processor_Type__c = 'SAS' LIMIT 1];
    }
}