public inherited sharing class MCALenderSettings {

    private MCA_Lender_Settings__c source {
        get {
            if (null == source) {
                source = getInstance();
            }
            return source;
        }
        set;
    }

    public String endpoint;

    public MCALenderSettings() {
        this.source = getInstance();
        this.endpoint = this.source.Endpoint__c;
    }

    private MCA_Lender_Settings__c getInstance() {
        return MCA_Lender_Settings__c.getInstance();
    }
}