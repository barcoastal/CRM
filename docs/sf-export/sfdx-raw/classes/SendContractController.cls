public without sharing class SendContractController {
    public String title { get; set; }
    public String recordId { get; set; }
    public String sId { get; set; }
    public Id templateId { get; set; }
    private static final String GEN_OPP_SEND_CONTRACT = 'Opportunity_SendContract_GenTemplate';
    private static final String GEN_OPP_QUICK_SEND_CONTRACT = 'Opportunity_QuickSendContract_GenTemplate';
    private static final String GEN_OPP_GBPP_ENROLLMENT = 'Opportunity_GBPPEnrollment_GenTemplate';
    private static final String QUICK_ACTION_SEND_CONTRACT = 'Opportunity.Send_Contract';
    private static final String QUICK_ACTION_QUICK_SEND_CONTRACT = 'Opportunity.Quick_Send_Contract';
    private static final String QUICK_ACTION_GBPP_ENROLLMENT = 'Opportunity.GBPP_Enrollment';
    private static final String GEN_OPP_RESTRUCTURE_SEND_CONTRACT = 'Opportunity_RestructureProgramContract_GenTemplate';
    private static final String QUICK_ACTION_RESTRUCTURE_SEND_CONTRACT = 'Opportunity.Restructure_Program_Contract';
    private static final String SEND_BANK_CONTRACT = 'Opportunity.Send_Bank_Change_Contract';
    private static final String GEN_OPP_SEND_BANK_CONTRACT = 'Opportunity_BankChangeContract_GenTemplate';

    public SendContractController() {
        title =  ApexPages.currentPage().getParameters().get('title');
        recordId = ApexPages.currentPage().getParameters().get('recordId');
        sId = ApexPages.currentPage().getParameters().get('sId');
        templateId = ApexPages.currentPage().getParameters().get('templateId');
    }
    public String sendWithRedirect(Id templateId, String sId, String recordId, String title) {
        PageReference pr = Page.SendContract;
        pr.getParameters().put('sId',sId);
        pr.getParameters().put('templateId',templateId);
        pr.getParameters().put('recordId', recordId);
        pr.getParameters().put('title', title);
        return pr.getUrl();
    }
    @AuraEnabled
    public static SendContractWrapper getSendContractDetails(Id oppId, String qiuckActionName){
        try {
            SendContractWrapper contractWrapper = new SendContractWrapper();
            Map<Id, Program_Plan__c> programPlanMap = ProgramPlanData.getProgramPlanDetailsMap(oppId);
            List<Debit_Schedule__c> debtSchedules = DebitScheduleData.queryDebitSchedules(programPlanMap.keySet());
            List<Draft__c> drafts = DraftData.queryDraftsBasedOnOpportunity(programPlanMap.keySet());
            List<Debt_Details__c> debtDetails = DebtDetailsData.getDebtDetailByOppId(oppId);
            contractWrapper.debtSchedules = debtSchedules;
            contractWrapper.debtDetails = debtDetails;
            contractWrapper.drafts = drafts;
            String genTemplateName;
            if (qiuckActionName != null && String.isNotBlank(qiuckActionName)) {
                //Assigning the docusign gen template name based on the quick action name
                if (qiuckActionName.equals(QUICK_ACTION_SEND_CONTRACT)) {
                    genTemplateName = GEN_OPP_SEND_CONTRACT;
                } else if (qiuckActionName.equals(QUICK_ACTION_QUICK_SEND_CONTRACT)) {
                    genTemplateName = GEN_OPP_QUICK_SEND_CONTRACT;
                }else if (qiuckActionName.equals(QUICK_ACTION_GBPP_ENROLLMENT)) {
                    genTemplateName = GEN_OPP_GBPP_ENROLLMENT;
                }else if (qiuckActionName.equals(QUICK_ACTION_RESTRUCTURE_SEND_CONTRACT)) {
                    genTemplateName = GEN_OPP_RESTRUCTURE_SEND_CONTRACT;
                } else if(qiuckActionName.equals(SEND_BANK_CONTRACT)) {
                    genTemplateName = GEN_OPP_SEND_BANK_CONTRACT;
                }
                if (genTemplateName != null && String.isNotBlank(genTemplateName)) {
                    dfsle__GenTemplate__c genTemplate = DocusignDocumentData.getGenTemplateByName(genTemplateName);
                    //Query and assign the docusign gen template Id and title based on the quick action and gen template name
                    if (genTemplate != null) {
                        contractWrapper.genTemplateId = genTemplate.Id;
                        contractWrapper.genTemplateTitle = genTemplate.dfsle__Description__c;
                    }
                }
            }
            return contractWrapper;
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }    
    
    /*@AuraEnabled(cacheable=true)
    public static Boolean checkDriveLicenseDocument(String oppId) {
        Boolean isAvailable = false;
        try{   
           Program_Plan__c programRec = [SELECT Id, Payment_Processor__r.Processor_Type__c FROM Program_Plan__c WHERE Opportunity__c =:oppId];
           if(programRec != null && programRec.Payment_Processor__r.Processor_Type__c == 'RAM'){   
               Opportunity oppRecord = OpportunityData.queryOpportunity(oppId)[0];
               ContentVersion con = FileData.getDriverLicenceDocument(oppRecord);
                if(con != null){
                    isAvailable = true;
                }
            }else{
                isAvailable = true;// Other than RAM Processor it will return true.
            }
            return isAvailable;
        }catch (Exception ex) {
            throw new CustomException(ex.getMessage());
        }        
    }*/

    @AuraEnabled
    public static void saveContractDetails(Account account, Contact contact, Opportunity opportunity) {
        try {

            Account acctRec = AccountData.queryAccount(account.Id)[0];
           List<Debt_Details__c> detDetailsWithoutCreditor = DebtDetailsData.getDebtDetailWithOutCreditorByOppId(opportunity.Id);
            if (account != null){
                if(StateCodeUtil.isNoBusinessState(account.BillingState)) {
                    throw new CustomException((System.Label.Sent_Contract_State_Validation));
                }
            }
            if(detDetailsWithoutCreditor.size() > 0){  
                throw new CustomException('Current Creditor should be populated for all Debts');
            }
            if (contact != null) {
                OpportunityLockService.disableOppLockForSystemUpdates();
                upsert contact;
                OpportunityLockService.reEnableOppLockAsSystemUpdatesDone();
            }

            if (account != null) {
                OpportunityLockService.disableOppLockForSystemUpdates();
                updateAccount(account, contact);
                OpportunityLockService.reEnableOppLockAsSystemUpdatesDone();
            }

            if (opportunity != null) {
                OpportunityLockService.disableOppLockForSystemUpdates();
                update opportunity;
                OpportunityLockService.reEnableOppLockAsSystemUpdatesDone();
            }

        } catch (Exception ex) {
            throw new CustomException(ex.getMessage());
        }
    }

    private static void updateAccount(Account account, Contact contact) {
        if (account == null) {
            return;
        }

        if (account.Primary_Contact__c == null && contact != null) {
            account.Primary_Contact__c = contact.Id;
        }
        update account;
    }
    
    @AuraEnabled(cacheable=true)
    public static String getSObjectName(String recordId) {
        return ApexUtil.getSObjectName(recordId);
    }

    public class SendContractWrapper {
        @AuraEnabled
        public  List<Debit_Schedule__c> debtSchedules{get;set;}
        @AuraEnabled
        public  List<Draft__c> drafts{get;set;}
        @AuraEnabled
        public  List<Debt_Details__c> debtDetails{get;set;}
        @AuraEnabled
        public Id genTemplateId {get;set;}
        @AuraEnabled
        public String genTemplateTitle {get;set;}
    }
}