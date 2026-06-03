/**
 * Description:
 * Provide controller functionality for the HealthCheck Lightning Web Component
 *                                          
 * History:
 **/

public with sharing class HealthCheckController {

    /* Based on the type of Id supplied, return an SObject of the appropriate type. */
    @AuraEnabled
    public static Map<String, Object> getItemHealth(Id id) {
        Map<String, Object> itemVm = new Map<String, Object>();

        /* Not sure this is the most efficient way, but whatever Id we are given, just go 
        look it up and jam it into the 'record' attribute of the VM (In case the HealthChecker wants to display some stuff from it) */
        itemVm.put('record',SObjectUtils.getObject(id));

        /*  A list to store all the results of all the health checks */
        List<HealthCheckerResult> healthCheckResultList = new List<HealthCheckerResult>();
        /* Use the factory to give us the list of all the health checkers
        We now give the factory the id, so it can figure out what type of checkers we need */
        for (HealthCheckerI oneChecker : HealthCheckerFactory.getHealthCheckers(id)) {
       
            /* Do the check here */
            List<HealthCheckerResult> oneResultList = oneChecker.check(id);
            for (HealthCheckerResult oneResult : oneResultList) {
                /* I don't think we'll bother with NA results right? */
                if (oneResult.isNA()) {continue;}
                /* OK, we should add this one in then */
                healthCheckResultList.add(oneResult);
            }
        }
        /* Let's be sure this is in the correct order before sending it back */
        healthCheckResultList.sort();

        itemVm.put('healthChecks', healthCheckResultList);
        itemVm.put('healthCheckSummary', buildHealthCheckSummary(healthCheckResultList));

        return itemVm;
    }

    /* We'll also try and figure out a sort of summary of all the checks here? 
    I wrote this bit of code and even I dont know whats going on!!! :( */
    private static Map<String, Object> buildHealthCheckSummary(List<HealthCheckerResult> results) {
        Map<String,Object> retSummary = new Map<String,Object>();

        /* What we want to try and do here is have a summary 'status' if you like
        The status will represent the 'worst' !!! status we find in all the results. Get it? */

        /* Assume we are all good to start off with, and to make this easier, we deal with 
        the ordinal value of the enum so we need to ensure we dont mess with the order the values
        are defined in the enum right. They need to be NA,SUCCESS, WARNING, ERROR  or this logic will 
        be messed up */
        Integer effectiveOrdinal = HealthCheckerResult.HealthCheckStatus.SUCCESS.ordinal();

        /* Assume we do not find any results that would prevent a 'Save' operation */
        Boolean effectivePreventSave = false;
        List<String> effectivePreventSaveMessages = new List<String>();

        /* For each of the results */
        for (HealthCheckerResult oneResult : results) {
            /* If it has a severity (ordinal) that is worse than the current (effective) severity */
            if (oneResult.status.ordinal() > effectiveOrdinal) {
                /* Then update it please */
                effectiveOrdinal = oneResult.status.ordinal();
            }
            /* In case we ever consider using this for validation too */
            /* If we find ANY results where this is true, well then ......       */
            if (oneResult.preventSave) {
                effectivePreventSave = true;
                effectivePreventSaveMessages.add(oneResult.message);
            }
        }
        /* Now we can translate that ordinal back into an effective Status */
        HealthCheckerResult.HealthCheckStatus effectiveStatus = HealthCheckerResult.HealthCheckStatus.values()[effectiveOrdinal];
        /* Figure out the vm related jazz for this (iconName and iconVariant) */
        String effectiveIconName = HealthCheckerResult.determineIconName(effectiveStatus);
        String effectiveIconVariant = HealthCheckerResult.determineIconVariant(effectiveStatus);
        /* Jam them in here */
        retSummary.put('status', effectiveStatus.name());
        retSummary.put('iconName', effectiveIconName);
        retSummary.put('iconVariant', effectiveIconVariant);
       
        /* In case we ever consider using this for validation too */
        retSummary.put('preventSave', effectivePreventSave);
        retSummary.put('preventSaveMessages', effectivePreventSaveMessages);
       
        /* and bail out .. Yippee */
        return retSummary;
    }
}