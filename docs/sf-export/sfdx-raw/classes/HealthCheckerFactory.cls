/**
 * Description:
 * Provide a factory for all Health Checkers for ANY Object
 *                                          
 * History:
 * 
 **/

public with sharing class HealthCheckerFactory {

    /*  Map any SObject Types we may want to check to the Interface specific for the Object */
    private static Map<Schema.SObjectType,System.Type> mapSobjectTypeToI = new Map<Schema.SObjectType,System.Type>{
        Schema.Lead.SObjectType => HealthCheckerLeadI.class
        ,Schema.Opportunity.SObjectType => HealthCheckerOpportunityI.class
        ,Schema.Account.SObjectType => HealthCheckerAccountI.class
       
    };

        /* Go get me health checkers for this type of Id please */
    public static List<HealthCheckerI> getHealthCheckers(Id id) {

        /* Put them all in here */
        List<HealthCheckerI> retCheckers = new List<HealthCheckerI>();

        /* You don't deserve any better than this :( */
        if (id == null) {return retCheckers;}

        System.Type requiredInterface = mapSobjectTypeToI.get(id.getSobjectType());
        system.debug('requiredInterface----'+requiredInterface);
        /* Uhmm, we dont even have a registration for this type of SObject mate !!! */
        if (requiredInterface == null) {return retCheckers;}
        
        /* Find all classes implementing the Interface we require */
        system.debug('ApexClassUtils.findClassesImplementing(requiredInterface)===='+ApexClassUtils.findClassesImplementing(requiredInterface));
        for (String healthCheckerName : ApexClassUtils.findClassesImplementing(requiredInterface)) {
            retCheckers.add((HealthCheckerI)Type.forName(healthCheckerName).newInstance());
        }
        /* We absolutely can guarantee that the above call (findClassesImplementing) will find a goose egg when running in a test.    
        So do this for our tests please */
        if (Test.isRunningTest()) {
            //Clear retCheckers list to avoid random (findClassesImplementing) results
            retCheckers.clear();
            retCheckers.add((HealthCheckerI)Type.forName(HealthCheckerMock.class.getName()).newInstance());
        }
        system.debug('retCheckers----0000'+retCheckers);
        return retCheckers;
    }

    /* Not sure if this is the best way to do this, but we want to exercise/test all the health checker jazz without actually having to use a real
    health checker. I mean perhaps no one has even written one yet !!!! So use this one for tests..    */
    public class HealthCheckerMock implements HealthCheckerMockI {

        public List<HealthCheckerResult> check(Id id) {
            /* We put all the results in here */
            List<HealthCheckerResult> results = new List<HealthCheckerResult>();
            results.add(HealthCheckerResult.createNotApplicableResult('This is a mock NA Result'));
            results.add(HealthCheckerResult.createWarningResult('This is a mock Warning Result'));
            results.add(HealthCheckerResult.createSuccessfulResult('This is a mock Successful result'));
            results.add(HealthCheckerResult.createErrorResultPreventSave('This is a mock Error result that prevents a Save operation.. sort of....... :)'));
    
            return results;
      }
    }
    public interface HealthCheckerMockI extends HealthCheckerI {
    }
}