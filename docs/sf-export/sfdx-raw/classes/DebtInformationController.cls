public without sharing class DebtInformationController {
    @AuraEnabled
    public static string saveDebtDetails(String recordId, String debtDetails){
        String result = '';
        try {
            if (String.isNotBlank(recordId)) {
                Lead leadInstance = new Lead();
                leadInstance.Id = recordId;
                List<DebtWrapper> debtWrap = (List<DebtWrapper>)JSON.deserialize(debtDetails, List<DebtWrapper>.class);   
                
                for (DebtWrapper wrap : debtWrap) {
                    
                    if (Integer.valueOf(wrap.Id) <= 10) {
                        leadInstance.put('Creditor_'+wrap.id+'_Name__c', wrap.creditor);
                        leadInstance.put('Creditor_'+wrap.id+'_Id__c', wrap.creditorId);
                        leadInstance.put('Creditor_'+wrap.id+'_Total_Debt__c', wrap.amount);
                        leadInstance.put('Creditor_'+wrap.id+'_Payment__c', wrap.payment);
                        leadInstance.put('Creditor_'+wrap.id+'_Payment_Frequency__c', wrap.frequency);
                        leadInstance.put('Creditor_'+wrap.id+'_Debt_Status__c', wrap.debtStatus);
                    }
                }
                
                if (debtWrap.size() < 10) {
                    for (Integer ctr = debtWrap.size()+1; ctr <= 10; ctr++) {
                        leadInstance.put('Creditor_'+ctr+'_Name__c', NULL);
                        leadInstance.put('Creditor_'+ctr+'_Id__c', NULL);
                        leadInstance.put('Creditor_'+ctr+'_Total_Debt__c', NULL);
                        leadInstance.put('Creditor_'+ctr+'_Payment__c', NULL);
                        leadInstance.put('Creditor_'+ctr+'_Payment_Frequency__c', NULL);
                        leadInstance.put('Creditor_'+ctr+'_Debt_Status__c', NULL);

                    }
                }
               
                Database.SaveResult saveResult = Database.update(leadInstance, false);
                IF (!saveResult.isSuccess()){
                    for(Database.Error err : saveResult.getErrors()){
                        result += err.getMessage();
                    }
                } ELSE {                    
                    result = 'success';  
                }  
            }  
        } catch (Exception e) {
            result = e.getMessage();
        }
        return result;
    }

    @AuraEnabled
    public static String getDebtDetails(String recordId) {
        List<Lead> debtDetailsList = [
            SELECT Id,Creditor_1_Debt_Status__c, Creditor_10_Name__c, Creditor_10_Payment_Frequency__c, Creditor_10_Payment__c, Creditor_10_Total_Debt__c, 
            Creditor_1_Name__c, Creditor_1_Id__c,  Creditor_1_Payment_Frequency__c, Creditor_1_Payment__c, Creditor_1_Total_Debt__c, 
            Creditor_2_Name__c, Creditor_2_Debt_Status__c,Creditor_2_Id__c,
            Creditor_2_Payment_Frequency__c, Creditor_2_Payment__c, Creditor_2_Total_Debt__c, Creditor_3_Name__c, Creditor_3_Debt_Status__c, Creditor_3_Id__c,
            Creditor_3_Payment_Frequency__c, Creditor_3_Payment__c, Creditor_3_Total_Debt__c, Creditor_4_Name__c, Creditor_4_Debt_Status__c, Creditor_4_Id__c,
            Creditor_4_Payment_Frequency__c, Creditor_4_Payment__c, Creditor_4_Total_Debt__c, Creditor_5_Name__c, Creditor_5_Debt_Status__c, Creditor_5_Id__c,
            Creditor_5_Payment_Frequency__c, Creditor_5_Payment__c, Creditor_5_Total_Debt__c, Creditor_6_Name__c, Creditor_6_Debt_Status__c, Creditor_6_Id__c,
            Creditor_6_Payment_Frequency__c, Creditor_6_Payment__c, Creditor_6_Total_Debt__c, Creditor_7_Name__c, Creditor_7_Debt_Status__c, Creditor_7_Id__c,
            Creditor_7_Payment_Frequency__c, Creditor_7_Payment__c, Creditor_7_Total_Debt__c, Creditor_8_Name__c, Creditor_8_Debt_Status__c, Creditor_8_Id__c,
            Creditor_8_Payment_Frequency__c, Creditor_8_Payment__c, Creditor_8_Total_Debt__c, Creditor_9_Name__c, Creditor_9_Debt_Status__c, Creditor_9_Id__c,
            Creditor_9_Payment_Frequency__c, Creditor_9_Payment__c, Creditor_9_Total_Debt__c ,Creditor_10_Debt_Status__c, Creditor_10_Id__c
            FROM Lead WHERE Id = :recordId LIMIT 1
        ];
        List<DebtWrapper> wrapList = new List<DebtWrapper>();
        if (debtDetailsList != null && !debtDetailsList.isEmpty()) {
            Lead debtDetails = debtDetailsList[0];
            for (Integer i = 1; i <=10; i++) {
                Decimal totalDebt = (Decimal)debtDetails.get('Creditor_'+i+'_Total_Debt__c');
                if (totalDebt != null && totalDebt > 0) {
                    DebtWrapper debtWrap = new DebtWrapper();
                    debtWrap.id = String.valueOf(i);
                    debtWrap.creditor = (String)debtDetails.get('Creditor_'+i+'_Name__c');
                    debtWrap.creditorId = (String)debtDetails.get('Creditor_'+i+'_Id__c');
                    debtWrap.amount = totalDebt;
                    debtWrap.payment = (Decimal)debtDetails.get('Creditor_'+i+'_Payment__c');
                    debtWrap.frequency = (String)debtDetails.get('Creditor_'+i+'_Payment_Frequency__c');
                    debtWrap.debtStatus = (String) debtDetails.get('Creditor_'+i+'_Debt_Status__c');
                    wrapList.add(debtWrap);
                }
            }
        }
        return JSON.serialize(wrapList);
    }

    @auraEnabled(cacheable=true)
    public static String isGuestUser(){
       String isGuestUserType = ApexUtil.getUserType() == 'Guest'?'true':'false';
       return isGuestUserType;
    }

    public class DebtWrapper {
        public String id;
        public String creditor;
        public String creditorId;
        public Decimal amount;
        public Decimal payment;
        public String frequency;
        public String debtStatus;
    }
}