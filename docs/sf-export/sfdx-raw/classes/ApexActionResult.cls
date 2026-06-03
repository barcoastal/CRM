public inherited sharing class ApexActionResult {
    
    public enum Statuses {
        SUCCESS,
        ERROR,
        WARNING
    }
    
    @AuraEnabled
    public Statuses status;
    @AuraEnabled
    public String message;
    @AuraEnabled
    public Object data;
    @AuraEnabled
    public String resultStatus {
        get {
            return this.status.name();
        }
    }

    public String scope;
    public Exception ex;

    public ApexActionResult() {
        this.status = ApexActionResult.Statuses.SUCCESS;
    }
    
    public ApexActionResult(String scope) {
        this.scope = scope;
        this.status = ApexActionResult.Statuses.SUCCESS;
    }

    public ApexActionResult(Exception ex, String scope) {
        this(scope);
        this.ex = ex;
        this.status = ApexActionResult.Statuses.ERROR;
        this.message = this.ex.getMessage();
    }

    public void thrown(Exception ex) {
        this.status = ApexActionResult.Statuses.ERROR;
        this.ex = ex;
        if (ex instanceof DmlException) {
            this.message = ex.getDmlMessage(0);
        } else {
            this.message = this.ex.getMessage();
        }
    }
}