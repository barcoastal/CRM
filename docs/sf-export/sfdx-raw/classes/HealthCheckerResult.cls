/**
 * Description:
 * This is the return type of the check() implementation on
 * either HealthCheckQuoteI or HealthCheckOpportunityI
 *                                          
 * History:
 **/
public with sharing class HealthCheckerResult implements Comparable {

    public HealthCheckStatus status {get; set;}

    @AuraEnabled
    public String message {get; set;}
    @AuraEnabled
    public String statusName {get; set;}
    @AuraEnabled
    public String iconName {get; set;}
    @AuraEnabled
    public String iconVariant {get; set;}

    /* We're playing with the idea of perhaps reusing the HealthChecker when updating an Item as well.     
    The idea is to attemt to eliminate possible duplicate code (somewhere) if a 'Health Check' really does need to 
    be enforced during the save of the record. Each health checker can set this (it will default to false) if they
    want :) */
    public Boolean preventSave {get; set;}

    /* Sorry mate, can't do one of these */
    private HealthCheckerResult() {}

    /* The only constructor we should use,and even then, only WE can use it :)  */
    private HealthCheckerResult(HealthCheckStatus status, String message, Boolean preventSave) {
       
        this.status = status;
        this.statusName = status.name();

        this.iconName = determineIconName(status);
        this.iconVariant = determineIconVariant(status);

        this.message = message;
        this.preventSave = preventSave;
    }

    /* Just make things a little easier for anyone who needs to check stuff */
    public Boolean isNA() {
        return this.status == HealthCheckStatus.NA;
    }
    /* Just make things a little easier for anyone who needs to check stuff */
    public Boolean isSuccess() {
        return this.status == HealthCheckStatus.SUCCESS;
    }
    /* Just make things a little easier for anyone who needs to check stuff */
    public Boolean isWarning() {
        return this.status == HealthCheckStatus.WARNING;
    }
    /* Just make things a little easier for anyone who needs to check stuff */
    public Boolean isError() {
        return this.status == HealthCheckStatus.ERROR;
    }

    /* Convenience (well actually, the only supported way to create a Success result) */
    public static HealthCheckerResult createSuccessfulResult(String message) {
        return new HealthCheckerResult(HealthCheckStatus.SUCCESS, message, false);
    }
    /* Convenience (well actually, the only supported way to create a Warning result) */
    public static HealthCheckerResult createWarningResult(String message) {
        return new HealthCheckerResult(HealthCheckStatus.WARNING, message, false);
    }
    /* Convenience (well actually, the only supported way to create an Error result) */
    public static HealthCheckerResult createErrorResult(String message) {
        return new HealthCheckerResult(HealthCheckStatus.ERROR, message, false);
    }
    /* Convenience (well actually, the only supported way to create a Warning result) */
    public static HealthCheckerResult createWarningResultPreventSave(String message) {
        return new HealthCheckerResult(HealthCheckStatus.WARNING, message, true);
    }
    /* Convenience (well actually, the only supported way to create an Error result) */
    public static HealthCheckerResult createErrorResultPreventSave(String message) {
        return new HealthCheckerResult(HealthCheckStatus.ERROR, message, true);
    }
    /* Convenience (well actually, the only supported way to create an NA result) */
    public static HealthCheckerResult createNotApplicableResult(String message) {
        return new HealthCheckerResult(HealthCheckStatus.NA, message, false);
    }

    /* This class is turning into a VM sort of thing, but I guess that is OK */
    public static String determineIconName(HealthCheckStatus status) {
        if (status == HealthCheckStatus.SUCCESS) {
            return 'utility:success';
        }
        if (status == HealthCheckStatus.WARNING) {
            return 'utility:warning';
        }
        if (status == HealthCheckStatus.ERROR) {
            return 'utility:error';
        }
        return 'utility:warning';
    }
     /* This class is turning into a VM sort of thing, but I guess that is OK */
     public static String determineIconVariant(HealthCheckStatus status) {
        if (status == HealthCheckStatus.SUCCESS) {
            return 'success';
        }
        if (status == HealthCheckStatus.WARNING) {
            return 'warning';
        }
        if (status == HealthCheckStatus.ERROR) {
            return 'error';
        }
        return 'warning';
    }
    /* We always want the list to be sorted from badness to goodness so */
    public Integer compareTo(Object compareTo) {
        HealthCheckerResult compareToHealthCheck = (HealthCheckerResult)compareTo;
        if (status.ordinal() == compareToHealthCheck.status.ordinal()) return 0;
        if (status.ordinal() < compareToHealthCheck.status.ordinal()) return 1;
        return -1;        
    }

    /* Righto, we'll have these four 'classes/types' of results?
    NA (Not applicable) option if the checker says the check is not really applicable */
    public enum HealthCheckStatus {NA, SUCCESS, WARNING, ERROR}
}