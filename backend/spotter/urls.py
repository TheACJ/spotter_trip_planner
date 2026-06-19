from django.urls import path
from trip_planner.views import plan_trip, health_check

urlpatterns = [
    path('api/plan-trip/', plan_trip),
    path('api/health/', health_check),
]
