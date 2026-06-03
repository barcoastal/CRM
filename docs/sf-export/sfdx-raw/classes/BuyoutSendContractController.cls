public with sharing class BuyoutSendContractController {
    public String title { get; set; }
    public String recordId { get; set; }
    public String sId { get; set; }
    public Id templateId { get; set; }
    private static final String GEN_OPP_BUYOUT_SEND_CONTRACT = 'Opportunity_BuyoutSendContract_GenTemplate';
    private static final String QUICK_ACTION_BUYOUT_SEND_CONTRACT = 'Opportunity.Buyout_Send_Contract';

    public BuyoutSendContractController() {
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
            contractWrapper.programPlanMap = programPlanMap;
            String genTemplateName;
            if (qiuckActionName != null && String.isNotBlank(qiuckActionName)) {
                //Assigning the docusign gen template name based on the quick action name
                if (qiuckActionName.equals(QUICK_ACTION_BUYOUT_SEND_CONTRACT)) {
                    genTemplateName = GEN_OPP_BUYOUT_SEND_CONTRACT;
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
   
    @AuraEnabled
    public static void saveContractDetails(Account account, Contact contact, Opportunity opportunity, Program_Plan__c programPlan) {
        try {
            Account acctRec = AccountData.queryAccount(account.Id)[0]; 
            Financial_Summary__c financialSummaryRec = new Financial_Summary__c();           
            
            if (account != null){
            
                if((acctRec.Actual_Program_Term__c == null || acctRec.Actual_Program_Term__c == 0) && (acctRec.Actual_Weekly_Payment__c == null || acctRec.Actual_Weekly_Payment__c == 0) &&
                    ( account.Actual_Program_Term__c == null || account.Actual_Program_Term__c == 0 || account.Actual_Weekly_Payment__c == null
                        || account.Actual_Weekly_Payment__c == 0)){
                        throw new CustomException('Actual Program Term or Actual Weekly Payment fields is missing');                                            
                }
                
                /** Commented below condition related to CRM-2346
                if(acctRec.HIGH_UCC_RISK__c && !acctRec.Qualified_Financial__c){
                    throw new CustomException((System.Label.Buyout_Contract_Validation));
                }*/                
               
                financialSummaryRec = FinancialSummaryData.getFinancialSummayDetail(account.Id)[0];                
                if(account.Actual_Program_Term__c != null ){
                    financialSummaryRec.Actual_Program_Term__c = account.Actual_Program_Term__c;                        
                }                
                if(account.Actual_Weekly_Payment__c != null){                      
                    financialSummaryRec.Actual_Weekly_Payment__c = account.Actual_Weekly_Payment__c;
                } 
            }
            
            if(financialSummaryRec != null){
                update financialSummaryRec;
            }

            if (contact != null) {
                upsert contact;
            }
            
            if (programPlan != null) {
                if(programPlan.First_Payment_Date__c == null && opportunity != null){
                    Map<Id, Program_Plan__c> programplanMap = ProgramPlanData.getProgramPlanDetailsMap(opportunity.Id);
                    opportunity.DS_First_Payment_Date__c = programplanMap.get(programPlan.Id).First_Payment_Date__c;
                    account.First_Draft_Date__c = programplanMap.get(programPlan.Id).First_Payment_Date__c;
                }else{
                    opportunity.DS_First_Payment_Date__c = programPlan.First_Payment_Date__c;
                    account.First_Draft_Date__c = programPlan.First_Payment_Date__c;
                }                                
                upsert programPlan;
            }

            if (account != null) {
                updateAccount(account, contact);
            }

            if (opportunity != null) {
                update opportunity;
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
        @AuraEnabled
        public Map<Id,Program_Plan__c> programPlanMap {get;set;}
    }
}