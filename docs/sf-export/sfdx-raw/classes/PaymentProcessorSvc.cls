/**
 * @description: A service class for the PaymentProcessor object
**/
public inherited sharing class PaymentProcessorSvc {

    public static final String PROC_SAS = 'SAS';
    public static final String PROC_RAM = 'RAM';

    private static final Set<String> STATES_RAM = RAMSettingsMDT.getSupportedStates();
    /**
     * @description: A method to get the payment processor Ids based on the state values
    **/
    public static Map<String, Id> getEligiblePaymentProcessorId(Set<String> states) {
        Map<String, Id> statePaymentProcIdMap = new Map<String, Id>();
        Set<String> procTypes = new Set<String>{PROC_SAS, PROC_RAM};
        boolean foundDefaultProcessor = false;
        List<Payment_Processor__c> thesePaymentProcessors = PaymentProcessorData.getPaymentProcessors();
        for (Payment_Processor__c thisProcessor : thesePaymentProcessors) {
            if (thisProcessor.Default_Processor__c) {
                foundDefaultProcessor = true;
                if (states != null && !states.isEmpty()) {
                    // If the processor is default, map it to all states
                    for (String thisState : states) {
                        statePaymentProcIdMap.put(thisState.toUpperCase(), thisProcessor.Id);
                    }
                } else {
                    statePaymentProcIdMap.put('DEFAULT', thisProcessor.Id);
                }

            }
        }
        if (!foundDefaultProcessor) {
            states.add('DEFAULT');
            if (states != null && !states.isEmpty()) {
                Map<String, Id> procTypeProcIdMap = PaymentProcessorData.getPaymentProcId(procTypes);
                for (String stateValue : states) {
                    stateValue = stateValue.toUpperCase();
                    
                    if (STATES_RAM.contains(stateValue)) {
                        if (procTypeProcIdMap.containsKey(PROC_RAM)) {
                            statePaymentProcIdMap.put(stateValue, procTypeProcIdMap.get(PROC_RAM));
                        }
                    } else {
                        if (procTypeProcIdMap.containsKey(PROC_SAS)) {
                            statePaymentProcIdMap.put(stateValue, procTypeProcIdMap.get(PROC_SAS));
                        }
                    }
                }
            }
        }

        return statePaymentProcIdMap;
    }
    // /**
    //  * @description: A method to get the payment processor Id based on the state value
    // **/
    // public static Id getEligiblePaymentProcId(String stateValue) {
    //     Id procId;
    //     if (String.isNotBlank(stateValue)) {
    //         stateValue = stateValue.toUpperCase();
    //     }
    //     if (STATES_RAM.contains(stateValue)) {
    //         procId = PaymentProcessorData.getPaymentProcId(PROC_RAM);
    //     } else {
    //         procId = PaymentProcessorData.getPaymentProcId(PROC_SAS);
    //     }
    //     return procId;
    // }

    // /**
    //  * @description: A method to get the payment processor Ids based on the state values
    // **/
    // public static Map<String, Id> getEligiblePaymentProcId(Set<String> states) {
    //     Map<String, Id> statePaymentProcIdMap = new Map<String, Id>();
    //     Set<String> procTypes = new Set<String>{PROC_SAS, PROC_RAM};
    //     boolean foundDefaultProcessor = false;
    //     List<Payment_Processor__c> thesePaymentProcessors = PaymentProcessorData.getPaymentProcessors();
    //     for (Payment_Processor__c thisProcessor : thesePaymentProcessors) {
    //         if (thisProcessor.Default_Processor__c) {
    //             foundDefaultProcessor = true;
    //             for (String thisState : states) {
    //                 statePaymentProcIdMap.put(thisState.toUpperCase(), thisProcessor.Id);
    //             }
    //         }
    //     }
    //     if (!foundDefaultProcessor) {
    //         if (states != null && !states.isEmpty()) {
    //             Map<String, Id> procTypeProcIdMap = PaymentProcessorData.getPaymentProcId(procTypes);
    //             for (String stateValue : states) {
    //                 stateValue = stateValue.toUpperCase();
    //                 if (STATES_RAM.contains(stateValue)) {
    //                     if (procTypeProcIdMap.containsKey(PROC_RAM)) {
    //                         statePaymentProcIdMap.put(stateValue, procTypeProcIdMap.get(PROC_RAM));
    //                     }
    //                 } else {
    //                     if (procTypeProcIdMap.containsKey(PROC_SAS)) {
    //                         statePaymentProcIdMap.put(stateValue, procTypeProcIdMap.get(PROC_SAS));
    //                     }
    //                 }
    //             }
    //         }
    //     }

    //     return statePaymentProcIdMap;
    // }


}