/**
 * Description: LeadService class provides the services to perform the business operations of Leads
*/
public inherited sharing class LeadService {

    /**
     * Description: Used to append the existing leads with in the system to the leads whose Ids are passed in this method.
     * The Leads whose Ids are passed in this method will survive and the appended existing lead will be deleted after the merging.
    */
    public static LeadServiceResult appendLeadsAndAddToFive9(Set<Id> leadIds, Id five9ListId) {
        LeadServiceResult leadSvcResult = new LeadServiceResult();
        try {
            if (leadIds != null && !leadIds.isEmpty()) {
                leadSvcResult.leadInstanceResult = AppendAndFive9LeadServicesHelper.initiateAppendLeadsAndAddToFive9(leadIds, five9ListId);
            } else {
                leadSvcResult.isSuccess = false;
                leadSvcResult.customError = 'The input parameter Lead Ids collection is empty';
            }
        } catch(Exception ex) {
            leadSvcResult.isSuccess = false;
            leadSvcResult.customError = ex.getMessage();
        }
        return leadSvcResult;
    }

    public static LeadServiceResult archiveLeads(Set<Id> leadIds) {
        LeadServiceResult leadSvcResult = new LeadServiceResult();
        try {
            if (leadIds != null && !leadIds.isEmpty()) {
                leadSvcResult.leadInstanceResult = AppendAndFive9LeadServicesHelper.archiveLeads(leadIds);
            } else {
                leadSvcResult.isSuccess = false;
                leadSvcResult.customError = 'The input parameter Lead Ids collection is empty';
            }
        } catch(Exception ex) {
            leadSvcResult.isSuccess = false;
            leadSvcResult.customError = ex.getMessage();
        }
        return leadSvcResult;
    }

    public static LeadServiceResult addToFive9(Set<Id> leadIds, Id five9ListId) {
        LeadServiceResult leadSvcResult = new LeadServiceResult();
        try {
            if (String.isBlank(five9ListId)) {
                leadSvcResult.isSuccess = false;
                leadSvcResult.customError = 'Five9 List Id is Empty';
            }
            if (leadIds != null && !leadIds.isEmpty()) {
                leadSvcResult.leadInstanceResult = AppendAndFive9LeadServicesHelper.initiateAddToFive9(leadIds, five9ListId);
            } else {
                leadSvcResult.isSuccess = false;
                leadSvcResult.customError = 'The input parameter Lead Ids collection is empty';
            }
        } catch(Exception ex) {
            leadSvcResult.isSuccess = false;
            leadSvcResult.customError = ex.getMessage();
        }
        return leadSvcResult;
    }

    public static LeadServiceResult removeFromFive9(Set<Id> leadIds, Id five9ListId) {
        LeadServiceResult leadSvcResult = new LeadServiceResult();
        try {
            if (String.isBlank(five9ListId)) {
                leadSvcResult.isSuccess = false;
                leadSvcResult.customError = 'Five9 List Id is Empty';
            }
            if (leadIds != null && !leadIds.isEmpty()) {
                leadSvcResult.leadInstanceResult = AppendAndFive9LeadServicesHelper.initiateRemoveFromFive9(leadIds, five9ListId);
            } else {
                leadSvcResult.isSuccess = false;
                leadSvcResult.customError = 'The input parameter Lead Ids collection is empty';
            }
        } catch(Exception ex) {
            leadSvcResult.isSuccess = false;
            leadSvcResult.customError = ex.getMessage();
        }
        return leadSvcResult;
    }

    public class LeadServiceResult {
        public Boolean isSuccess;
        public String customError;
        public Map<Id, LeadResult> leadInstanceResult;

        public LeadServiceResult() {
            this.isSuccess = true;
        }

        public LeadServiceResult(String customError) {
            this.isSuccess = false;
            this.customError = customError;
        }
    }

    public class LeadResult {
        public Id leadId;
        public Boolean isSuccess;
        public String customError;
        public Map<String, String> additionalValues;
        public Database.UpsertResult dmlResult;

        public LeadResult() {
            this.isSuccess = true;
            this.additionalValues = new Map<String, String>();
        }

        public LeadResult(String customError) {
            this.isSuccess = false;
            this.customError = customError;
        }
    }
}